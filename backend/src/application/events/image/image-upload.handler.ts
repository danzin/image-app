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
		console.log(`New image uploaded by ${event.uploaderPublicId}, invalidating relevant feeds`);

		try {
			console.log(`Invalidating uploader's own feed: ${event.uploaderPublicId}`);
			// Invalidate both legacy and new feed cache patterns for the uploader
			const uploaderLegacyPattern = `feed:${event.uploaderPublicId}:*`;
			const uploaderCorePattern = `core_feed:${event.uploaderPublicId}:*`;

			console.log(`Deleting cache patterns for uploader: ${uploaderLegacyPattern}, ${uploaderCorePattern}`);
			await Promise.all([this.redis.del(uploaderLegacyPattern), this.redis.del(uploaderCorePattern)]);

			// Get followers of the uploader
			const followers = await this.getFollowersOfUser(event.uploaderPublicId);
			console.log(`Found ${followers.length} followers: ${followers.join(", ")}`);

			// Get users interested in the image's tags
			const tagInterestedUsers = await this.getUsersInterestedInTags(event.tags);
			console.log(
				`Found ${tagInterestedUsers.length} users interested in tags [${event.tags.join(
					", "
				)}]: ${tagInterestedUsers.join(", ")}`
			);

			// Combine and deduplicate
			const affectedUsers = [...new Set([...followers, ...tagInterestedUsers])];

			if (affectedUsers.length > 0) {
				// Invalidate both legacy and new feed cache patterns for affected users
				const legacyCachePatterns = affectedUsers.map((publicId) => `feed:${publicId}:*`);
				const coreCachePatterns = affectedUsers.map((publicId) => `core_feed:${publicId}:*`);
				const allPatterns = [...legacyCachePatterns, ...coreCachePatterns];

				console.log(`Deleting cache patterns for ${affectedUsers.length} affected users:`, allPatterns);
				await Promise.all(allPatterns.map((pattern) => this.redis.del(pattern)));

				console.log(` Invalidated feeds (legacy + core) for ${affectedUsers.length} users due to new image upload`);
			} else {
				console.log(`No affected users found (no followers or tag-interested users)`);
			}
		} catch (error) {
			console.error("Error handling image upload:", error);
			// Fallback: nuke all feeds (both legacy and new patterns)
			console.log(" FALLBACK: Nuking all feed caches due to error");
			await Promise.all([this.redis.del("feed:*"), this.redis.del("core_feed:*")]);
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
