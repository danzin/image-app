import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { ImageDeletedEvent } from "./image.event";
import { RedisService } from "../../../services/redis.service";
import { UserRepository } from "../../../repositories/user.repository";

@injectable()
export class ImageDeleteHandler implements IEventHandler<ImageDeletedEvent> {
	constructor(
		@inject("RedisService") private readonly redis: RedisService,
		@inject("UserRepository") private readonly userRepository: UserRepository
	) {}

	async handle(event: ImageDeletedEvent): Promise<void> {
		console.log(`Image deleted: ${event.imageId} by ${event.uploaderPublicId}, invalidating relevant feeds`);

		try {
			// use tag-based invalidation for active cache entries
			const tagsToInvalidate: string[] = [];

			tagsToInvalidate.push("trending_feed");

			// invalidate uploader's personalized feeds
			tagsToInvalidate.push(`user_feed:${event.uploaderPublicId}`);
			tagsToInvalidate.push(`user_for_you_feed:${event.uploaderPublicId}`);

			// get followers and invalidate their feeds
			const followers = await this.getFollowersOfUser(event.uploaderPublicId);
			if (followers.length > 0) {
				console.log(`Invalidating feeds for ${followers.length} followers`);
				followers.forEach((publicId) => {
					tagsToInvalidate.push(`user_feed:${publicId}`);
					tagsToInvalidate.push(`user_for_you_feed:${publicId}`);
				});
			}

			// use tag-based invalidation (efficient - only deletes keys with these tags)
			console.log(`Invalidating cache with ${tagsToInvalidate.length} tags`);
			await this.redis.invalidateByTags(tagsToInvalidate);

			// also do pattern-based cleanup for any keys that might not have tag metadata
			// (e.g., if tags expired but cache keys haven't yet)
			const patterns = [
				`core_feed:${event.uploaderPublicId}:*`,
				`for_you_feed:${event.uploaderPublicId}:*`,
				"trending_feed:*",
				// do NOT clear new_feed - lazy refresh only
			];

			// add follower patterns
			followers.forEach((publicId) => {
				patterns.push(`core_feed:${publicId}:*`);
				patterns.push(`for_you_feed:${publicId}:*`);
			});

			await this.redis.deletePatterns(patterns);

			console.log(`Feed invalidation complete for image deletion`);
		} catch (error) {
			console.error("Error handling image deletion:", error);
			const fallbackPatterns = ["core_feed:*", "for_you_feed:*", "trending_feed:*"];
			await this.redis.deletePatterns(fallbackPatterns);
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
}
