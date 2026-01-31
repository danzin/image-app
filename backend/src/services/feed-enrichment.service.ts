import { inject, injectable } from "tsyringe";
import { RedisService } from "./redis.service";
import { IUserReadRepository } from "@/repositories/interfaces";
import { FeedPost, UserLookupData } from "@/types";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";
import { CacheConfig } from "@/config/cacheConfig";
import { UserRepository } from "@/repositories/user.repository";

@injectable()
export class FeedEnrichmentService {
	constructor(
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
	) {}

	/**
	 * Hydrates a list of FeedPosts with fresh User and Meta data.
	 *
	 * @pattern Read-Time Hydration
	 * @complexity O(N) where N is feed size (uses batched lookups).
	 *
	 * @param coreFeedData - The core feed structure containing post IDs and user IDs.
	 * @param options - Options to control data refreshing.
	 * @returns {Promise<FeedPost[]>} A list of enriched feed posts.
	 */
	async enrichFeedWithCurrentData(
		coreFeedData: FeedPost[],
		options: { refreshUserData: boolean } = { refreshUserData: true },
	): Promise<FeedPost[]> {
		if (!coreFeedData || coreFeedData.length === 0) return [];

		const postPublicIds = [...new Set(coreFeedData.map((item) => item.publicId).filter(Boolean))];
		let userMap = new Map<string, UserLookupData>();

		if (options.refreshUserData) {
			// Extract unique user publicIds from feed items
			const userPublicIds = [...new Set(coreFeedData.map((item) => item.userPublicId))];

			const userData = await this.getUsersWithCache(userPublicIds);
			userMap = new Map<string, UserLookupData>(userData.map((user: UserLookupData) => [user.publicId, user]));
		}

		// attempt to load per-post metadata with tag-based caching
		// Assuming granular key is better: post_meta:{id}
		const postMetaKeys = postPublicIds.map((id) => CacheKeyBuilder.getPostMetaKey(id));

		// Ideally use mGet if available, else Promise.all
		const metaResults = await Promise.all(
			postMetaKeys.map((k) => this.redisService.getWithTags<any>(k).catch(() => null)),
		);

		const metaMap = new Map<string, any>();
		postPublicIds.forEach((id, idx) => {
			if (metaResults[idx]) metaMap.set(id, metaResults[idx]);
		});

		// merge fresh user/image data into core feed
		return coreFeedData.map((item) => {
			const meta = metaMap.get(item.publicId);
			const user = userMap.get(item.userPublicId);
			return {
				...item,
				likes: meta?.likes ?? item.likes,
				commentsCount: meta?.commentsCount ?? item.commentsCount,
				viewsCount: meta?.viewsCount ?? item.viewsCount,
				user: user
					? {
							publicId: user.publicId,
							username: user.username,
							avatar: user.avatar ?? "",
						}
					: item.user,
			};
		});
	}

	/**
	 * Fetches users with granular caching strategy.
	 * Prevents duplication of cache keys for overlapping sets of users.
	 */
	private async getUsersWithCache(userPublicIds: string[]): Promise<UserLookupData[]> {
		if (userPublicIds.length === 0) return [];

		const results: UserLookupData[] = [];
		const missingIds: string[] = [];

		// Try to fetch each user individually from cache
		// Since RedisService doesn't expose mget, we use Promise.all
		const cachedUsers = await Promise.all(
			userPublicIds.map(async (id) => {
				const key = CacheKeyBuilder.getUserDataKey(id);
				const data = await this.redisService.getWithTags<UserLookupData>(key);
				return { id, data };
			}),
		);

		for (const { id, data } of cachedUsers) {
			if (data) {
				results.push(data);
			} else {
				missingIds.push(id);
			}
		}

		if (missingIds.length > 0) {
			// Fetch missing from DB
			// Note: UserRepository.findUsersByPublicIds returns UserLookupData[]
			const fetchedUsers = await this.userReadRepository.findUsersByPublicIds(missingIds);

			// Store missing back to cache individually
			await Promise.all(
				fetchedUsers.map((user) => {
					const key = CacheKeyBuilder.getUserDataKey(user.publicId);
					// Tag with user_data:{id} for invalidation
					return this.redisService.setWithTags(key, user, [`user_data:${user.publicId}`], CacheConfig.FEED.USER_DATA);
				}),
			);

			results.push(...fetchedUsers);
		}

		return results;
	}
}
