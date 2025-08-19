import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { UserInteractedWithImageEvent } from "../user/user-interaction.event";
import { FeedService } from "../../../services/feed.service";
import { RedisService } from "../../../services/redis.service";
import { UserRepository } from "../../../repositories/user.repository";
import { UserPreferenceRepository } from "../../../repositories/userPreference.repository";

@injectable()
export class FeedInteractionHandler implements IEventHandler<UserInteractedWithImageEvent> {
	constructor(
		@inject("FeedService") private readonly feedService: FeedService,
		@inject("RedisService") private readonly redis: RedisService,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("UserPreferenceRepository") private readonly userPreferenceRepository: UserPreferenceRepository
	) {}

	async handle(event: UserInteractedWithImageEvent): Promise<void> {
		try {
			await this.feedService.recordInteraction(event.userId, event.interactionType, event.imageId, event.tags);

			await this.invalidateRelevantFeeds(event);
		} catch (error) {
			console.error("Feed update failed:", error);
			throw error;
		}
	}

	/**
	 * Invalidate feeds for users who would see this interaction change
	 */
	private async invalidateRelevantFeeds(event: UserInteractedWithImageEvent): Promise<void> {
		console.log(`Smart cache invalidation for interaction: ${event.interactionType} on image ${event.imageId}`);

		// Always invalidate the acting user's feed
		await this.redis.del(`feed:${event.userId}:*`);

		// Get users who would see this image in their feeds
		const affectedUsers = await this.getAffectedUsers(event);

		// Invalidate their feeds too
		if (affectedUsers.length > 0) {
			const cachePatterns = affectedUsers.map((publicId) => `feed:${publicId}:*`);
			await Promise.all(cachePatterns.map((pattern) => this.redis.del(pattern)));

			console.log(`Invalidated feeds for ${affectedUsers.length} users who might see this image`);
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
			await this.redis.del("feed:*");
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
}
