import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { PostDeletedEvent } from "./post.event";
import { RedisService } from "../../../services/redis.service";
import { UserRepository } from "../../../repositories/user.repository";

@injectable()
export class PostDeleteHandler implements IEventHandler<PostDeletedEvent> {
	constructor(
		@inject("RedisService") private readonly redis: RedisService,
		@inject("UserRepository") private readonly userRepository: UserRepository
	) {}

	async handle(event: PostDeletedEvent): Promise<void> {
		console.log(`Post deleted: ${event.postId} by ${event.authorPublicId}, invalidating relevant feeds`);

		try {
			const tagsToInvalidate: string[] = [];

			tagsToInvalidate.push("trending_feed", "new_feed");
			tagsToInvalidate.push(`user_feed:${event.authorPublicId}`);
			tagsToInvalidate.push(`user_for_you_feed:${event.authorPublicId}`);

			const followers = await this.getFollowersOfUser(event.authorPublicId);
			if (followers.length > 0) {
				console.log(`Invalidating feeds for ${followers.length} followers`);
				followers.forEach((publicId) => {
					tagsToInvalidate.push(`user_feed:${publicId}`);
					tagsToInvalidate.push(`user_for_you_feed:${publicId}`);
				});
			}

			console.log(`Invalidating cache with ${tagsToInvalidate.length} tags`);
			await this.redis.invalidateByTags(tagsToInvalidate);

			const patterns = [
				`core_feed:${event.authorPublicId}:*`,
				`for_you_feed:${event.authorPublicId}:*`,
				"trending_feed:*",
				"new_feed:*",
			];

			followers.forEach((publicId) => {
				patterns.push(`core_feed:${publicId}:*`);
				patterns.push(`for_you_feed:${publicId}:*`);
			});

			await this.redis.deletePatterns(patterns);

			await this.redis.publish(
				"feed_updates",
				JSON.stringify({
					type: "post_deleted",
					postId: event.postId,
					authorId: event.authorPublicId,
					timestamp: new Date().toISOString(),
				})
			);

			console.log(`Feed invalidation complete for post deletion`);
		} catch (error) {
			console.error("Error handling post deletion:", error);
			const fallbackPatterns = ["core_feed:*", "for_you_feed:*", "trending_feed:*", "new_feed:*"];
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
