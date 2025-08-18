import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { ImageUploadedEvent } from "../user/user-interaction.event";
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
		console.log(`New image uploaded by ${event.uploaderPublicId}, invalidating relevant feeds`);

		try {
			console.log(`Invalidating uploader's own feed: ${event.uploaderPublicId}`);
			await this.redis.del(`feed:${event.uploaderPublicId}:*`);
			// Get followers of the uploader
			const followers = await this.getFollowersOfUser(event.uploaderPublicId);

			// Get users interested in the image's tags
			const tagInterestedUsers = await this.getUsersInterestedInTags(event.tags);

			// Combine and deduplicate
			const affectedUsers = [...new Set([...followers, ...tagInterestedUsers])];

			if (affectedUsers.length > 0) {
				const cachePatterns = affectedUsers.map((publicId) => `feed:${publicId}:*`);
				await Promise.all(cachePatterns.map((pattern) => this.redis.del(pattern)));

				console.log(`Invalidated feeds for ${affectedUsers.length} users due to new image upload`);
			}
		} catch (error) {
			console.error("Error handling image upload:", error);
			// Fallback: nuke all feeds
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
