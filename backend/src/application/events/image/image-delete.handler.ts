import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { ImageDeletedEvent } from "../user/user-interaction.event";
import { RedisService } from "../../../services/redis.service";
import { UserRepository } from "../../../repositories/user.repository";

@injectable()
export class ImageDeleteHandler implements IEventHandler<ImageDeletedEvent> {
	constructor(
		@inject("RedisService") private readonly redis: RedisService,
		@inject("UserRepository") private readonly userRepository: UserRepository
	) {}

	async handle(event: ImageDeletedEvent): Promise<void> {
		console.log(`Image deleted by ${event.uploaderPublicId}, invalidating relevant feeds`);

		try {
			// Get followers of the uploader (they might have seen this image)
			const followers = await this.getFollowersOfUser(event.uploaderPublicId);

			if (followers.length > 0) {
				const cachePatterns = followers.map((publicId) => `feed:${publicId}:*`);
				await Promise.all(cachePatterns.map((pattern) => this.redis.del(pattern)));

				console.log(`Invalidated feeds for ${followers.length} followers due to image deletion`);
			}
		} catch (error) {
			console.error("Error handling image deletion:", error);
			// Fallback: invalidate all feeds
			await this.redis.del("feed:*");
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
