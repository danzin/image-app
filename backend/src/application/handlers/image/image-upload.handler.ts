import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { ImageUploadedEvent } from "../../events/image/image.event";
import { RedisService } from "../../../services/redis.service";
import { UserRepository } from "../../../repositories/user.repository";
import { UserPreferenceRepository } from "../../../repositories/userPreference.repository";

@injectable()
export class ImageUploadHandler implements IEventHandler<ImageUploadedEvent> {
	constructor(
		@inject("RedisService") private readonly redis: RedisService,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("UserPreferenceRepository") private readonly userPreferenceRepository: UserPreferenceRepository
	) {}

	async handle(event: ImageUploadedEvent): Promise<void> {
		console.log(`[IMAGE_UPLOAD_HANDLER] New image uploaded by ${event.uploaderPublicId}, invalidating relevant feeds`);

		try {
			// use tag-based invalidation for efficient cache clearing
			const tagsToInvalidate: string[] = [];

			// invalidate global discovery feeds (trending, new)
			tagsToInvalidate.push("trending_feed", "new_feed");

			// invalidate uploader's own feeds
			tagsToInvalidate.push(`user_feed:${event.uploaderPublicId}`);
			tagsToInvalidate.push(`user_for_you_feed:${event.uploaderPublicId}`);

			console.log(`[IMAGE_UPLOAD_HANDLER] Getting followers for user: ${event.uploaderPublicId}`);
			const followers = await this.getFollowersOfUser(event.uploaderPublicId);
			console.log(`[IMAGE_UPLOAD_HANDLER] Found ${followers.length} followers`);

			// Get users interested in the image's tags
			console.log(`[IMAGE_UPLOAD_HANDLER] Getting users interested in tags: ${event.tags.join(", ")}`);
			const tagInterestedUsers = await this.getUsersInterestedInTags(event.tags);
			console.log(`[IMAGE_UPLOAD_HANDLER] Found ${tagInterestedUsers.length} users interested in tags`);

			// Combine and deduplicate affected users
			const affectedUsers = [...new Set([...followers, ...tagInterestedUsers])];
			console.log(`[IMAGE_UPLOAD_HANDLER] Total affected users: ${affectedUsers.length}`);

			if (affectedUsers.length > 0) {
				// invalidate affected users' feeds using tags
				affectedUsers.forEach((userId) => {
					tagsToInvalidate.push(`user_feed:${userId}`);
					tagsToInvalidate.push(`user_for_you_feed:${userId}`);
				});
			}

			// tag-based invalidation (primary)
			console.log(`[IMAGE_UPLOAD_HANDLER] Invalidating cache with ${tagsToInvalidate.length} tags`);
			await this.redis.invalidateByTags(tagsToInvalidate);

			// pattern-based cleanup (backup) for any keys without tag metadata
			const patterns = [
				`core_feed:${event.uploaderPublicId}:*`,
				`for_you_feed:${event.uploaderPublicId}:*`,
				"trending_feed:*",
				"new_feed:*",
			];

			affectedUsers.forEach((userId) => {
				patterns.push(`core_feed:${userId}:*`);
				patterns.push(`for_you_feed:${userId}:*`);
			});

			await this.redis.deletePatterns(patterns);

			// Publish real-time feed update for WebSocket notifications
			if (affectedUsers.length > 0) {
				await this.redis.publish(
					"feed_updates",
					JSON.stringify({
						type: "new_image",
						uploaderId: event.uploaderPublicId,
						imageId: event.imageId,
						tags: event.tags,
						affectedUsers,
						timestamp: new Date().toISOString(),
					})
				);
			}

			// Publish global discovery feed update
			await this.redis.publish(
				"feed_updates",
				JSON.stringify({
					type: "new_image_global",
					uploaderId: event.uploaderPublicId,
					imageId: event.imageId,
					tags: event.tags,
					timestamp: new Date().toISOString(),
				})
			);

			console.log(`[IMAGE_UPLOAD_HANDLER] Cache invalidation complete for new image upload`);
		} catch (error) {
			console.error("[IMAGE_UPLOAD_HANDLER] Error handling image upload:", error);
			// Fallback: invalidate all feed patterns
			const fallbackPatterns = ["core_feed:*", "for_you_feed:*", "trending_feed:*", "new_feed:*"];
			await this.redis.deletePatterns(fallbackPatterns);
		}
	}

	private async getFollowersOfUser(userPublicId: string): Promise<string[]> {
		try {
			const followers = await this.userRepository.findUsersFollowing(userPublicId);
			return followers.map((user) => user.publicId);
		} catch (error) {
			console.error(`[IMAGE_UPLOAD_HANDLER] Error getting followers for user ${userPublicId}:`, error);
			return [];
		}
	}

	private async getUsersInterestedInTags(tags: string[]): Promise<string[]> {
		try {
			if (!tags || tags.length === 0) return [];
			const interestedUsers = await this.userPreferenceRepository.getUsersWithTagPreferences(tags);
			return interestedUsers.map((user) => user.publicId);
		} catch (error) {
			console.error(`[IMAGE_UPLOAD_HANDLER] Error getting users interested in tags ${tags.join(", ")}:`, error);
			return [];
		}
	}
}
