import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPersonalizedFeedQuery } from "./getPersonalizedFeed.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { UserPreferenceRepository } from "../../../../repositories/userPreference.repository";
import { RedisService } from "../../../../services/redis.service";
import { EventBus } from "../../../common/buses/event.bus";
import { ColdStartFeedGeneratedEvent } from "../../../events/ColdStartFeedGenerated.event";
import { createError } from "../../../../utils/errors";
import { FollowRepository } from "../../../../repositories/follow.repository";
import { CoreFeed, FeedPost, PaginatedFeedResult, UserLookupData } from "types/index";

@injectable()
export class GetPersonalizedFeedQueryHandler implements IQueryHandler<GetPersonalizedFeedQuery, any> {
	constructor(
		@inject("PostRepository") private postRepository: PostRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("RedisService") private redisService: RedisService,
		@inject("EventBus") private eventBus: EventBus
	) {}

	async execute(query: GetPersonalizedFeedQuery): Promise<PaginatedFeedResult> {
		const { userId, page, limit } = query;
		console.log(`Running partitioned getPersonalizedFeed for userId: ${userId}`);
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

		try {
			// Get core feed structure (post IDs and order)
			const coreFeedKey = `core_feed:${userId}:${safePage}:${safeLimit}`;
			let coreFeed = (await this.redisService.getWithTags(coreFeedKey)) as CoreFeed | null;

			if (!coreFeed) {
				// cache miss - generate core feed
				console.log("Core feed cache miss, generating...");
				coreFeed = await this.generateCoreFeed(userId, safePage, safeLimit);

				// store in redis with tags for smart invalidation
				const tags = [`user_feed:${userId}`, `feed_safePage:${safePage}`, `feed_safeLimit:${safeLimit}`];
				await this.redisService.setWithTags(coreFeedKey, coreFeed, tags, 300); // 5 minutes
			} else {
				console.log("Core feed cache hit");
			}

			// Enrich core feed with fresh user data
			const enrichedFeed: FeedPost[] = await this.enrichFeedWithCurrentData(coreFeed.data);

			return {
				...coreFeed,
				data: enrichedFeed,
			};
		} catch (error) {
			console.error("Failed to generate personalized feed:", error);
			throw createError(
				"UnknownError",
				`Could not generate personalized feed for user ${userId}: ${(error as Error).message}`
			);
		}
	}

	// the feed builder
	// new user - discovery/trending feed (getRankedFeed)
	// established user - posts from following + tag preferences (getFeedForUserCore)
	private async generateCoreFeed(userId: string, safePage: number, safeLimit: number): Promise<CoreFeed> {
		const user = await this.userRepository.findByPublicId(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const [topTags, followingIds] = await Promise.all([
			this.userPreferenceRepository.getTopUserTags(user.id),
			this.followRepository.getFollowingObjectIds(user.id),
		]);
		const favoriteTags = topTags.map((pref: any) => pref.tag);
		const skip = (safePage - 1) * safeLimit;

		// cold start scenario - user has no following and no tag preferences
		if (followingIds.length === 0 && favoriteTags.length === 0) {
			if (safePage === 1) {
				try {
					await this.eventBus.publish(new ColdStartFeedGeneratedEvent(userId));
				} catch {
					// non-fatal, ignore
				}
			}

			return this.postRepository.getRankedFeed(favoriteTags, safeLimit, skip);
		}

		return this.postRepository.getFeedForUserCore(followingIds, favoriteTags, safeLimit, skip);
	}

	// enrichment layer - fetch current user data and dynamic meta (likes/comments) with tag-based caching
	private async enrichFeedWithCurrentData(coreFeedData: any[]): Promise<FeedPost[]> {
		if (!coreFeedData || coreFeedData.length === 0) return [];

		// extract unique user publicIds from feed items
		const userPublicIds = [...new Set(coreFeedData.map((item) => item.userPublicId))];
		const postPublicIds = [...new Set(coreFeedData.map((item) => item.publicId).filter(Boolean))];

		// batch fetch user data with tag-based caching
		const userDataKey = `user_batch:${userPublicIds.sort().join(",")}`;
		let userData = (await this.redisService.getWithTags(userDataKey)) as UserLookupData[] | null;

		if (!userData) {
			userData = await this.userRepository.findUsersByPublicIds(userPublicIds);
			// cache with user-specific tags for avatar invalidation
			const userTags = userPublicIds.map((id) => `user_data:${id}`);
			await this.redisService.setWithTags(userDataKey, userData, userTags, 60); // 1 minute cache
		}

		const userMap = new Map<string, UserLookupData>(userData.map((user: UserLookupData) => [user.publicId, user]));

		// attempt to load per-post metadata with tag-based caching
		const postMetaKeys = postPublicIds.map((id) => `post_meta:${id}`);
		const metaResults = await Promise.all(postMetaKeys.map((k) => this.redisService.getWithTags(k).catch(() => null)));
		const metaMap = new Map<string, any>();
		postPublicIds.forEach((id, idx) => {
			if (metaResults[idx]) metaMap.set(id, metaResults[idx]);
		});

		// merge fresh user/image data into core feed
		return coreFeedData.map((item) => {
			const meta = metaMap.get(item.publicId);
			return {
				...item,
				likes: meta?.likes ?? item.likes,
				commentsCount: meta?.commentsCount ?? item.commentsCount,
				viewsCount: meta?.viewsCount ?? item.viewsCount,
				user: {
					publicId: userMap.get(item.userPublicId)?.publicId,
					username: userMap.get(item.userPublicId)?.username,
					avatar: userMap.get(item.userPublicId)?.avatar,
				},
			};
		});
	}
}
