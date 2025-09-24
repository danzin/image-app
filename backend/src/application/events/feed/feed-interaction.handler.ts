import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { UserInteractedWithImageEvent } from "../user/user-interaction.event";
import { FeedService } from "../../../services/feed.service";
import { RedisService } from "../../../services/redis.service";
import { UserRepository } from "../../../repositories/user.repository";
import { UserPreferenceRepository } from "../../../repositories/userPreference.repository";
import { ImageRepository } from "../../../repositories/image.repository";

@injectable()
export class FeedInteractionHandler implements IEventHandler<UserInteractedWithImageEvent> {
	constructor(
		@inject("FeedService") private readonly feedService: FeedService,
		@inject("RedisService") private readonly redis: RedisService,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("UserPreferenceRepository") private readonly userPreferenceRepository: UserPreferenceRepository,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository
	) {}

	async handle(event: UserInteractedWithImageEvent): Promise<void> {
		try {
			await this.feedService.recordInteraction(event.userId, event.interactionType, event.imageId, event.tags);

			await this.invalidateRelevantFeeds(event);
			
			// Publish real-time interaction event for WebSocket notifications
			await this.publishInteractionEvent(event);
		} catch (error) {
			console.error("Feed update failed:", error);
			throw error;
		}
	}

	/**
	 * Invalidate feeds for users who would see this interaction change
	 */
	private async invalidateRelevantFeeds(event: UserInteractedWithImageEvent): Promise<void> {
		console.log(`Smart cache handling for interaction: ${event.interactionType} on image ${event.imageId}`);

		const isLikeEvent = event.interactionType === "like" || event.interactionType === "unlike";

		if (isLikeEvent) {
			// Update per-image meta so all users see new like count without structural invalidation
			try {
				console.log(`event.imageId in invalidateRelevantFeeds: ${event.imageId}`);
				const image = await this.imageRepository.findByPublicId(event.imageId);
				if (image && (image as any).publicId) {
					await this.feedService.updateImageLikeMeta((image as any).publicId, (image as any).likes || 0);
				}
			} catch (e) {
				console.warn("Failed to update image like meta during like/unlike event", e);
			}
			// Invalidate only actor's structural feed so their personalization (tag score changes) can reorder
			await this.redis.deletePatterns([`core_feed:${event.userId}:*`, `feed:${event.userId}:*`]);
			console.log("Selective invalidation done (actor only) for like/unlike; others rely on meta overlay");
			return;
		}

		// Non-like events (e.g., comments) may affect counts not covered by meta yet; perform broader invalidation
		await this.redis.deletePatterns([`feed:${event.userId}:*`, `core_feed:${event.userId}:*`]);
		const affectedUsers = await this.getAffectedUsers(event);
		if (affectedUsers.length > 0) {
			const cachePatternsLegacy = affectedUsers.map((publicId) => `feed:${publicId}:*`);
			const cachePatternsCore = affectedUsers.map((publicId) => `core_feed:${publicId}:*`);
			await Promise.all([...cachePatternsLegacy, ...cachePatternsCore].map((pattern) => this.redis.del(pattern)));
			console.log(`Invalidated feeds (legacy + core) for ${affectedUsers.length} users (non-like event)`);
		}
	}
	/**
	 * Determine which users would see this image in their personalized feeds
	 */
	private async getAffectedUsers(event: UserInteractedWithImageEvent): Promise<string[]> {
		const affectedUsers: string[] = [];

		try {
			// get image owner followers
			if (event.imageOwnerId) {
				const followers = await this.getFollowersOfUser(event.imageOwnerId);
				affectedUsers.push(...followers);
			}

			// users who are interested in these tags
			if (event.tags && event.tags.length > 0) {
				const tagInterestedUsers = await this.getUsersInterestedInTags(event.tags);
				affectedUsers.push(...tagInterestedUsers);
			}

			// Remove duplicates and the acting user because it's already handled above
			return [...new Set(affectedUsers)].filter((id) => id !== event.userId);
		} catch (error) {
			console.error("Error determining affected users:", error);
			// Fallback: invalidate all feeds (nuclear option)
			await this.redis.deletePatterns(["feed:*", "core_feed:*"]);
			return [];
		}
	}

	private async getFollowersOfUser(userPublicId: string): Promise<string[]> {
		try {
			const followers = await this.userRepository.findUsersFollowing(userPublicId);
			return followers.map((user) => user.publicId);
		} catch (error) {
			console.error(`Error getting followers for user ${userPublicId}:`, error);
			return [];
		}
	}

	private async getUsersInterestedInTags(tags: string[]): Promise<string[]> {
		try {
			const interestedUsers = await this.userPreferenceRepository.getUsersWithTagPreferences(tags);
			return interestedUsers.map((user) => user.publicId);
		} catch (error) {
			console.error(`Error getting users interested in tags ${tags.join(", ")}:`, error);
			return [];
		}
	}

	/**
	 * Publish real-time interaction event to Redis for WebSocket broadcasting
	 */
	private async publishInteractionEvent(event: UserInteractedWithImageEvent): Promise<void> {
		try {
			const interactionMessage = {
				type: "interaction" as const,
				userId: event.userId,
				actionType: event.interactionType,
				targetId: event.imageId,
				tags: event.tags,
				timestamp: new Date().toISOString(),
			};

			await this.redis.publish("feed_updates", JSON.stringify(interactionMessage));
			console.log(`Published real-time interaction event: ${event.interactionType} on image ${event.imageId} by user ${event.userId}`);
		} catch (error) {
			console.error("Failed to publish interaction event:", error);
		}
	}
}
