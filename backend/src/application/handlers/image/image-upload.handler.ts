import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { ImageUploadedEvent } from "../../events/image/image.event";
import { RedisService } from "../../../services/redis.service";
import { IUserReadRepository } from "../../../repositories/interfaces/IUserReadRepository";
import { UserPreferenceRepository } from "../../../repositories/userPreference.repository";
import { logger } from "../../../utils/winston";

@injectable()
export class ImageUploadHandler implements IEventHandler<ImageUploadedEvent> {
	constructor(
		@inject("RedisService") private readonly redis: RedisService,
		@inject("UserReadRepository") private readonly userRepository: IUserReadRepository,
		@inject("UserPreferenceRepository") private readonly userPreferenceRepository: UserPreferenceRepository,
	) {}

	async handle(event: ImageUploadedEvent): Promise<void> {
		logger.info(`[IMAGE_UPLOAD_HANDLER] New image uploaded by ${event.uploaderPublicId}, invalidating relevant feeds`);

		try {
			// use tag-based invalidation for efficient cache clearing
			const tagsToInvalidate: string[] = [];

			tagsToInvalidate.push("trending_feed");

			// invalidate uploader's own feeds
			tagsToInvalidate.push(`user_feed:${event.uploaderPublicId}`);
			tagsToInvalidate.push(`user_for_you_feed:${event.uploaderPublicId}`);

			logger.info(`[IMAGE_UPLOAD_HANDLER] Getting followers for user: ${event.uploaderPublicId}`);
			const followers = await this.getFollowersOfUser(event.uploaderPublicId);
			logger.info(`[IMAGE_UPLOAD_HANDLER] Found ${followers.length} followers`);

			// Get users interested in the image's tags
			logger.info(`[IMAGE_UPLOAD_HANDLER] Getting users interested in tags: ${event.tags.join(", ")}`);
			const tagInterestedUsers = await this.getUsersInterestedInTags(event.tags);
			logger.info(`[IMAGE_UPLOAD_HANDLER] Found ${tagInterestedUsers.length} users interested in tags`);

			// Combine and deduplicate affected users
			const affectedUsers = [...new Set([...followers, ...tagInterestedUsers])];
			logger.info(`[IMAGE_UPLOAD_HANDLER] Total affected users: ${affectedUsers.length}`);

			// Batch processing to prevent Redis pipeline overflow or event loop blocking
			const BATCH_SIZE = 500;

			if (affectedUsers.length > 0) {
				for (let i = 0; i < affectedUsers.length; i += BATCH_SIZE) {
					const batch = affectedUsers.slice(i, i + BATCH_SIZE);
					const batchTags: string[] = [];
					const batchPatterns: string[] = [];

					batch.forEach((userId) => {
						// Tags for invalidation
						batchTags.push(`user_feed:${userId}`);
						batchTags.push(`user_for_you_feed:${userId}`);

						// Patterns for cleanup
						batchPatterns.push(`core_feed:${userId}:*`);
						batchPatterns.push(`for_you_feed:${userId}:*`);
					});

					// Execute batch invalidation
					await this.redis.invalidateByTags(batchTags);
					await this.redis.deletePatterns(batchPatterns);

					// Publish real-time updates for this batch
					await this.redis.publish(
						"feed_updates",
						JSON.stringify({
							type: "new_image",
							uploaderId: event.uploaderPublicId,
							imageId: event.imageId,
							tags: event.tags,
							affectedUsers: batch,
							timestamp: new Date().toISOString(),
						}),
					);
				}
			}

			// tag-based invalidation (primary)
			logger.info(`[IMAGE_UPLOAD_HANDLER] Invalidating cache with ${tagsToInvalidate.length} tags`);
			await this.redis.invalidateByTags(tagsToInvalidate);

			// pattern-based cleanup (backup) for any keys without tag metadata
			const patterns = [
				`core_feed:${event.uploaderPublicId}:*`,
				`for_you_feed:${event.uploaderPublicId}:*`,
				"trending_feed:*",
				// do NOT clear new_feed - lazy refresh only
			];

			await this.redis.deletePatterns(patterns);

			// do NOT publish global discovery feed update - new feed refreshes on-demand only

			logger.info(`[IMAGE_UPLOAD_HANDLER] Cache invalidation complete for new image upload`);
		} catch (error) {
			console.error("[IMAGE_UPLOAD_HANDLER] Error handling image upload:", error);
			const fallbackPatterns = ["core_feed:*", "for_you_feed:*", "trending_feed:*"];
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
