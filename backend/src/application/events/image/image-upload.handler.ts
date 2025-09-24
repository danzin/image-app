import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { ImageUploadedEvent } from "./image.event";
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
			console.log(`[IMAGE_UPLOAD_HANDLER] Invalidating uploader's own feed: ${event.uploaderPublicId}`);
			// Direct cache invalidation for uploader (same as follow service)
			await this.redis.deletePatterns([
				`feed:${event.uploaderPublicId}:*`,
				`core_feed:${event.uploaderPublicId}:*`,
				`for_you_feed:${event.uploaderPublicId}:*`,
			]);

			// Get followers of the uploader
			console.log(`[IMAGE_UPLOAD_HANDLER] Getting followers for user: ${event.uploaderPublicId}`);
			const followers = await this.getFollowersOfUser(event.uploaderPublicId);
			console.log(`[IMAGE_UPLOAD_HANDLER] Found ${followers.length} followers: ${followers.join(", ")}`);

			// Get users interested in the image's tags
			console.log(`[IMAGE_UPLOAD_HANDLER] Getting users interested in tags: ${event.tags}`);
			const tagInterestedUsers = await this.getUsersInterestedInTags(event.tags);
			console.log(
				`[IMAGE_UPLOAD_HANDLER] Found ${tagInterestedUsers.length} users interested in tags [${event.tags.join(
					", "
				)}]: ${tagInterestedUsers.join(", ")}`
			);

			// Combine and deduplicate
			const affectedUsers = [...new Set([...followers, ...tagInterestedUsers])];
			console.log(`[IMAGE_UPLOAD_HANDLER] Total affected users: ${affectedUsers.length} - ${affectedUsers.join(", ")}`);

			if (affectedUsers.length > 0) {
				// Direct cache invalidation for affected users (same as follow service)
				const feedPatterns: string[] = [];
				for (const userId of affectedUsers) {
					feedPatterns.push(`feed:${userId}:*`);
					feedPatterns.push(`core_feed:${userId}:*`);
					feedPatterns.push(`for_you_feed:${userId}:*`);
				}
				console.log(`[IMAGE_UPLOAD_HANDLER] Invalidating cache patterns: ${feedPatterns.join(", ")}`);
				await this.redis.deletePatterns(feedPatterns);

				// Also invalidate using the tag-based invalidation for the new system
				const tagInvalidationTargets = affectedUsers.map((userId) => `user_feed:${userId}`);
				console.log(`[IMAGE_UPLOAD_HANDLER] Invalidating using tags: ${tagInvalidationTargets.join(", ")}`);
				await this.redis.invalidateByTags(tagInvalidationTargets);

				// Publish real-time feed update notifications for followers
				await this.redis.publish("feed_updates", {
					type: "new_image",
					uploaderId: event.uploaderPublicId,
					imageId: event.imageId,
					tags: event.tags,
					affectedUsers,
					timestamp: new Date().toISOString(),
				});

				console.log(
					`[IMAGE_UPLOAD_HANDLER] Smart cache invalidation completed for ${affectedUsers.length} users due to new image upload`
				);
			}

			// ALWAYS publish global new image event for discovery feeds (no cache invalidation)
			await this.redis.publish("feed_updates", {
				type: "new_image_global",
				uploaderId: event.uploaderPublicId,
				imageId: event.imageId,
				tags: event.tags,
				timestamp: new Date().toISOString(),
			});
			console.log(`[IMAGE_UPLOAD_HANDLER] Published global new image event for discovery feeds`);

			if (affectedUsers.length === 0) {
				console.log(`[IMAGE_UPLOAD_HANDLER] No affected users found (no followers or tag-interested users)`);
			}
		} catch (error) {
			console.error("[IMAGE_UPLOAD_HANDLER] Error handling image upload:", error);
			// Fallback: nuke all feeds (both legacy and new patterns)
			console.log("[IMAGE_UPLOAD_HANDLER] FALLBACK: Nuking all feed caches due to error");
			await Promise.all([this.redis.del("feed:*"), this.redis.del("core_feed:*")]);
		}
	}

	private async getFollowersOfUser(userPublicId: string): Promise<string[]> {
		try {
			console.log(`[IMAGE_UPLOAD_HANDLER] Getting followers for userPublicId: ${userPublicId}`);
			const followers = await this.userRepository.findUsersFollowing(userPublicId);
			console.log(
				`[IMAGE_UPLOAD_HANDLER] Raw followers result:`,
				followers.map((f) => ({ publicId: f.publicId, username: f.username }))
			);
			return followers.map((user) => user.publicId);
		} catch (error) {
			console.error(`[IMAGE_UPLOAD_HANDLER] Error getting followers for user ${userPublicId}:`, error);
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
