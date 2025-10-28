import { inject, injectable } from "tsyringe";
import { PostRepository } from "../repositories/post.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { RedisService } from "./redis.service";
import { IUser, UserLookupData } from "../types";
import { EventBus } from "../application/common/buses/event.bus";
import { ColdStartFeedGeneratedEvent } from "../application/events/ColdStartFeedGenerated.event";
import { redisLogger, errorLogger } from "../utils/winston";

@injectable()
export class FeedService {
	constructor(
		@inject("PostRepository") private postRepository: PostRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
		@inject("UserActionRepository") private userActionRepository: UserActionRepository,

		@inject("RedisService") private redisService: RedisService,
		@inject("EventBus") private eventBus: EventBus
	) {}

	// New partitioned implementation of core feed layer
	// generates personalized feed based on user's following list
	// in 2 layers: Core feed and Enrichment.
	// This way when a user changes avatar, I don't rebuild the whole feed. Just refresh the user data layer

	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<any> {
		console.log(`Running partitioned getPersonalizedFeed for userId: ${userId}`);

		try {
			// STEP 1: Get core feed structure (post IDs and order)
			const coreFeedKey = `core_feed:${userId}:${page}:${limit}`;
			let coreFeed = await this.redisService.getWithTags(coreFeedKey);

			if (!coreFeed) {
				// Cache miss - generate core feed
				console.log("Core feed cache miss, generating...");
				coreFeed = await this.generateCoreFeed(userId, page, limit);

				// Store in redis with tags for smart invalidation
				const tags = [`user_feed:${userId}`, `feed_page:${page}`, `feed_limit:${limit}`];
				await this.redisService.setWithTags(coreFeedKey, coreFeed, tags, 300); // 5 minutes
			} else {
				console.log("Core feed cache hit");
			}

			// SSTEP2:  Enrich core feed with fresh user data
			const enrichedFeed = await this.enrichFeedWithCurrentData(coreFeed.data);

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

	// The feed builder.
	// New user - Discovery/Trending feed(getRankedFeed)
	// Established user - Images from following + tag preferences (getFeedForUserCore)
	private async generateCoreFeed(userId: string, page: number, limit: number) {
		const [user, topTags] = await Promise.all([
			this.userRepository.findByPublicId(userId),
			this.userRepository
				.findByPublicId(userId)
				.then((user: IUser | null) => (user ? this.userPreferenceRepository.getTopUserTags(String(user._id)) : [])),
		]);

		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const followingIds = user.following || [];
		const favoriteTags = topTags.map((pref) => pref.tag);
		const skip = (page - 1) * limit;

		if (followingIds.length === 0 && favoriteTags.length === 0) {
			if (page === 1) {
				try {
					await this.eventBus.publish(new ColdStartFeedGeneratedEvent(userId));
				} catch {
					// non-fatal, ignore
				}
			}

			return this.postRepository.getRankedFeed(favoriteTags, limit, skip);
		}

		return this.postRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip);
	}

	// === Specialized feeds ===

	// For you - personalized recommendations (sorted sets)
	public async getForYouFeed(userId: string, page: number, limit: number): Promise<any> {
		redisLogger.info(`getForYouFeed called`, { userId, page, limit });

		try {
			// try to get from sorted set first
			const postIds = await this.redisService.getFeedPage(userId, page, limit, "for_you");
			redisLogger.debug(`getFeedPage returned`, { userId, postCount: postIds.length });

			if (postIds.length > 0) {
				redisLogger.info(`For You feed ZSET HIT`, { userId, postCount: postIds.length });
				// fetch post details individually (TODO: add batch fetch to PostRepository)
				const postPromises = postIds.map((id) => this.postRepository.findByPublicId(id));
				const postsResults = await Promise.all(postPromises);
				const posts = postsResults.filter((p) => p !== null);

				redisLogger.debug(`Fetched post details`, { requested: postIds.length, found: posts.length });

				const enriched = await this.enrichFeedWithCurrentData(posts);
				const feedSize = await this.redisService.getFeedSize(userId, "for_you");

				return {
					data: enriched,
					page,
					limit,
					total: feedSize,
				};
			}

			// cache miss - generate feed and populate sorted set
			redisLogger.info(`For You feed ZSET MISS, generating from DB`, { userId });
			const feed = await this.generateForYouFeed(userId, page, limit);

			// populate sorted set with all posts (fire-and-forget for page 1)
			if (page === 1 && feed.data && feed.data.length > 0) {
				const timestamp = Date.now();
				redisLogger.info(`Populating ZSET for user`, { userId, postCount: feed.data.length });
				Promise.all(
					feed.data.map((post: any, idx: number) =>
						this.redisService.addToFeed(userId, post.publicId, timestamp - idx, "for_you")
					)
				).catch((err) => {
					errorLogger.error(`Failed to populate For You feed ZSET`, { userId, error: err.message });
				});
			}

			const enriched = await this.enrichFeedWithCurrentData(feed.data);
			return {
				...feed,
				data: enriched,
			};
		} catch (error) {
			errorLogger.error("For You feed error", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw createError("FeedError", "Could not generate For You feed.");
		}
	}
	private async generateForYouFeed(userId: string, page: number, limit: number) {
		const [user, topTags] = await Promise.all([
			this.userRepository.findByPublicId(userId),
			this.userRepository
				.findByPublicId(userId)
				.then((user: IUser | null) => (user ? this.userPreferenceRepository.getTopUserTags(String(user._id)) : [])),
		]);

		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const favoriteTags = topTags.map((pref) => pref.tag);
		const skip = (page - 1) * limit;

		const feed = await this.postRepository.getRankedFeed(favoriteTags, limit, skip);

		return feed;
	}

	// Trending - ranked by popularity + recency
	public async getTrendingFeed(page: number, limit: number): Promise<any> {
		const key = `trending_feed:${page}:${limit}`;
		let cached = await this.redisService.getWithTags(key);
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getTrendingFeed(limit, skip, { timeWindowDays: 14, minLikes: 1 });
			await this.redisService.setWithTags(key, core, ["trending_feed", `page:${page}`, `limit:${limit}`], 120);
			cached = core;
		}
		const enriched = await this.enrichFeedWithCurrentData(cached.data);
		return { ...cached, data: enriched };
	}

	// New feed - sorted by recency
	public async getNewFeed(page: number, limit: number): Promise<any> {
		const key = `new_feed:${page}:${limit}`;
		let cached = await this.redisService.getWithTags(key);
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getNewFeed(limit, skip);
			await this.redisService.setWithTags(key, core, ["new_feed", `page:${page}`, `limit:${limit}`], 60);
			cached = core;
		}
		const enriched = await this.enrichFeedWithCurrentData(cached.data);
		return { ...cached, data: enriched };
	}

	// === Misc ===

	// Enrichment layer - fetch current user data and dynamic meta (likes/comments) with tag-based caching
	private async enrichFeedWithCurrentData(coreFeedData: any[]): Promise<any[]> {
		if (!coreFeedData || coreFeedData.length === 0) return [];

		// Extract unique user publicIds from feed items
		const userPublicIds = [...new Set(coreFeedData.map((item) => item.userPublicId))];
		const postPublicIds = [...new Set(coreFeedData.map((item) => item.publicId).filter(Boolean))];

		// Batch fetch user data with tag-based caching
		const userDataKey = `user_batch:${userPublicIds.sort().join(",")}`;
		let userData = await this.redisService.getWithTags(userDataKey);

		if (!userData) {
			userData = await this.userRepository.findUsersByPublicIds(userPublicIds);
			// Cache with user-specific tags for avatar invalidation
			const userTags = userPublicIds.map((id) => `user_data:${id}`);
			await this.redisService.setWithTags(userDataKey, userData, userTags, 60); // 1 minute cache
		}

		const userMap = new Map<string, UserLookupData>(userData.map((user: UserLookupData) => [user.publicId, user]));

		// Attempt to load per-post metadata with tag-based caching
		const postMetaKeys = postPublicIds.map((id) => `post_meta:${id}`);
		const metaResults = await Promise.all(postMetaKeys.map((k) => this.redisService.getWithTags(k).catch(() => null)));
		const metaMap = new Map<string, any>();
		postPublicIds.forEach((id, idx) => {
			if (metaResults[idx]) metaMap.set(id, metaResults[idx]);
		});

		// Merge fresh user/image data into core feed
		return coreFeedData.map((item) => {
			const meta = metaMap.get(item.publicId);
			return {
				...item,
				likes: meta?.likes ?? item.likes,
				user: {
					publicId: userMap.get(item.userPublicId)?.publicId,
					username: userMap.get(item.userPublicId)?.username,
					avatar: userMap.get(item.userPublicId)?.avatar,
				},
			};
		});
	}

	// Real time invalidation (now works with sorted sets)
	public async recordInteraction(
		userPublicId: string,
		actionType: string,
		targetIdentifier: string,
		tags: string[]
	): Promise<void> {
		console.log(
			`Running recordInteraction... for ${userPublicId}, actionType: ${actionType}, targetId: ${targetIdentifier}, tags: ${tags}`
		);
		// Resolve user internal id
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");

		// If action targets a post provided by publicId (may include extension), normalize
		let internalTargetId = targetIdentifier;
		if (
			actionType === "like" ||
			actionType === "unlike" ||
			actionType === "comment" ||
			actionType === "comment_deleted"
		) {
			const sanitized = targetIdentifier.replace(/\.[a-z0-9]{2,5}$/i, "");
			const post = await this.postRepository.findByPublicId(sanitized);
			if (post) internalTargetId = (post as any)._id.toString();
		}

		// Log the action to user activity collection
		await this.userActionRepository.logAction(String(user._id), actionType, internalTargetId);

		let scoreIncrement = 0;
		if (actionType === "like" || actionType === "unlike") {
			scoreIncrement = this.getScoreIncrementForAction(actionType);
		}

		// Update tag preferences based on action type (like: +2, unlike: -2)
		if (scoreIncrement !== 0) {
			await Promise.all(
				tags.map((tag) => this.userPreferenceRepository.incrementTagScore(String(user._id), tag, scoreIncrement))
			);
		}

		// Invalidate sorted set feeds for this user
		await this.redisService.invalidateFeed(userPublicId, "for_you");
		await this.redisService.invalidateFeed(userPublicId, "personalized");

		// Also invalidate old tag-based caches for backward compatibility
		const invalidationTags = [`user_feed:${userPublicId}`];
		await this.redisService.invalidateByTags(invalidationTags);

		// Publish to Redis pub/sub for real-time updates
		await this.redisService.publish(
			"feed_updates",
			JSON.stringify({
				type: "interaction",
				userId: userPublicId,
				actionType,
				targetId: targetIdentifier,
				tags,
				timestamp: new Date().toISOString(),
			})
		);

		console.log("Feed invalidation completed for user interaction");
	}

	/**
	 * Update per-post meta cache after like/unlike without regenerating entire feed partition.
	 */
	public async updatePostLikeMeta(postPublicId: string, newTotalLikes: number): Promise<void> {
		const metaKey = `post_meta:${postPublicId}`;
		const tags = [`post_meta:${postPublicId}`, `post_likes:${postPublicId}`];

		//Update cached like counts
		await this.redisService.setWithTags(metaKey, { likes: newTotalLikes }, tags, 300);

		// Broadcast to all connected clients
		await this.redisService.publish(
			"feed_updates",
			JSON.stringify({
				type: "like_update",
				postId: postPublicId,
				newLikes: newTotalLikes,
				timestamp: new Date().toISOString(),
			})
		);
	}

	private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
		const scoreMap: Record<"like" | "unlike", number> = {
			like: 2,
			unlike: -2,
		};
		return scoreMap[actionType] ?? 0;
	}

	// === Batch Feed Operations (for post creation/deletion) ===

	/**
	 * Add post to followers' feeds in batch (when user creates post)
	 */
	public async fanOutPostToFollowers(postId: string, authorId: string, timestamp: number): Promise<void> {
		console.log(`Fanning out post ${postId} from author ${authorId} to followers`);

		try {
			const author = await this.userRepository.findByPublicId(authorId);
			if (!author) {
				console.warn(`Author ${authorId} not found, skipping fan-out`);
				return;
			}

			const followerIds = author.followers || [];
			if (followerIds.length === 0) {
				console.log(`Author ${authorId} has no followers, skipping fan-out`);
				return;
			}

			// add post to all followers' for_you feeds
			await this.redisService.addToFeedsBatch(followerIds, postId, timestamp, "for_you");
			console.log(`Fanned out post ${postId} to ${followerIds.length} followers`);
		} catch (error) {
			console.error(`Failed to fan out post ${postId}:`, error);
			// non-fatal, feeds will rebuild on next read
		}
	}

	/**
	 * Remove post from followers' feeds (when user deletes post)
	 */
	public async removePostFromFollowers(postId: string, authorId: string): Promise<void> {
		console.log(`Removing post ${postId} from followers of ${authorId}`);

		try {
			const author = await this.userRepository.findByPublicId(authorId);
			if (!author) return;

			const followerIds = author.followers || [];
			if (followerIds.length === 0) return;

			await this.redisService.removeFromFeedsBatch(followerIds, postId, "for_you");
			console.log(`Removed post ${postId} from ${followerIds.length} followers' feeds`);
		} catch (error) {
			console.error(`Failed to remove post ${postId} from feeds:`, error);
		}
	}
}
