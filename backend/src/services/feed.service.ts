import { inject, injectable } from "tsyringe";
import { PostRepository } from "@/repositories/post.repository";
import { UserRepository } from "@/repositories/user.repository";
import { UserPreferenceRepository } from "@/repositories/userPreference.repository";
import { UserActionRepository } from "@/repositories/userAction.repository";
import { FollowRepository } from "@/repositories/follow.repository";
import { createError } from "@/utils/errors";
import { RedisService } from "./redis.service";
import { DTOService } from "./dto.service";
import { FeedEnrichmentService } from "./feed-enrichment.service";
import { EventBus } from "@/application/common/buses/event.bus";
import { PaginationResult, PostDTO, UserLookupData, FeedPost, PostMeta, CoreFeed } from "@/types";
import { ColdStartFeedGeneratedEvent } from "@/application/events/ColdStartFeedGenerated.event";
import { logger } from "@/utils/winston";
import { CacheConfig } from "@/config/cacheConfig";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";

/**
 * @class FeedService
 * @description Manages the generation and delivery of personalized and global feeds.
 *
 * @architecture Partitioned Feed System
 * @strategy Two-Layer Caching (Core + Enrichment)
 * @why Traditional feeds that cache full HTML/JSON objects require massive invalidation
 * when a single user changes their avatar. We split the "Structure" (IDs) from the
 * "Content" (Data) to optimize cache hit rates and reduce database load.
 */
@injectable()
export class FeedService {
	constructor(
		@inject("PostRepository") private postRepository: PostRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
		@inject("UserActionRepository") private userActionRepository: UserActionRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("RedisService") private redisService: RedisService,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EventBus") private eventBus: EventBus,
		@inject("FeedEnrichmentService") private readonly feedEnrichmentService: FeedEnrichmentService,
	) {}

	/**
	 * Generates a personalized feed for a user based on their followings and interests.
	 *
	 * @pattern Core + Enrichment Separation
	 * @strategy Cache Partitioning
	 * @why Separates the feed structure (IDs) from the presentation data (User profiles, Likes).
	 * 1. **Core Feed**: Caches the structure (Post IDs). Invalidated only on new posts.
	 * 2. **Enrichment**: Fetches fresh metadata. Cached with short TTLs.
	 * This separation prevents rebuilding the entire feed for minor updates like an avatar change.
	 *
	 * @param userId - The public ID of the user requesting the feed.
	 * @param page - The page number for pagination.
	 * @param limit - The number of items per page.
	 * @returns {Promise<PaginationResult<PostDTO>>} A paginated list of enriched post DTOs.
	 */
	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		logger.info(`Running partitioned getPersonalizedFeed for userId: ${userId}`);

		try {
			// STEP 1: Get core feed structure (post IDs and order)
			const coreFeedKey = `core_feed:${userId}:${page}:${limit}`;
			let coreFeed = await this.redisService.getWithTags<CoreFeed>(coreFeedKey);
			const isCacheHit = !!coreFeed; // convert the result of the lookup to boolean

			if (!coreFeed) {
				// Cache miss - generate core feed
				logger.info("Core feed cache miss, generating...");
				coreFeed = await this.generateCoreFeed(userId, page, limit);

				// Store in redis with tags for smart invalidation
				const tags = [`user_feed:${userId}`, `feed_page:${page}`, `feed_limit:${limit}`];
				await this.redisService.setWithTags(coreFeedKey, coreFeed, tags, 300); // 5 minutes
			} else {
				logger.info("Core feed cache hit");
			}

			// SSTEP2:  Enrich core feed with fresh user data, but only
			const enrichedFeed = await this.feedEnrichmentService.enrichFeedWithCurrentData(coreFeed.data, {
				refreshUserData: isCacheHit,
			});

			return {
				...coreFeed,
				data: this.mapToPostDTOArray(enrichedFeed),
			};
		} catch (error) {
			console.error("Failed to generate personalized feed:", error);
			throw createError(
				"UnknownError",
				`Could not generate personalized feed for user ${userId}: ${(error as Error).message}`,
			);
		}
	}

	/**
	 * Generates the core structure of a user's feed.
	 *
	 * @strategy Aggregation / Cold Start Handling
	 * @why If the user is new (no followers), we fallback to a "Discovery" feed to ensure
	 * the screen is never empty. For established users, we aggregate data from their
	 * follow graph and tag preferences.
	 *
	 * @private
	 * @param userId - The public ID of the user.
	 * @param page - The page number.
	 * @param limit - Items per page.
	 * @returns {Promise<CoreFeed>} The core feed structure, containing post IDs and minimal data.
	 */
	private async generateCoreFeed(userId: string, page: number, limit: number): Promise<CoreFeed> {
		const user = await this.userRepository.findByPublicId(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const [topTags, followingIds] = await Promise.all([
			this.userPreferenceRepository.getTopUserTags(user.id),
			this.followRepository.getFollowingObjectIds(user.id),
		]);
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

			return this.postRepository.getNewFeed(limit, skip) as Promise<CoreFeed>;
		}

		return this.postRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip) as Promise<CoreFeed>;
	}

	// === Specialized feeds ===

	/**
	 * Retrieves a trending feed ranked by popularity and recency.
	 *
	 * @pattern Ranked Feed
	 * @strategy Time-Decay Ranking
	 * @why We use a custom scoring algorithm (Recency + Log(Likes)) to ensure the
	 * trending page stays fresh and doesn't just show the oldest, most-liked posts forever.
	 *
	 * @param page - The page number.
	 * @param limit - The number of items per page.
	 * @returns {Promise<PaginationResult<PostDTO>>}
	 */
	public async getTrendingFeed(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const key = CacheKeyBuilder.getCoreFeedKey("trending", page, limit).replace("core_feed", "trending_feed"); // Or keep as is, but consistency check
		// The key prefix was manually trending_feed. Let's stick to consistent CacheKeyBuilder if possible, or adapt.
		// CacheKeyBuilder has CORE_FEED. I should probably add specific method or use generic helper.
		// For now, I will use `CacheKeyBuilder.PREFIXES.TRENDING_FEED` if I added it... I didn't.
		// I'll stick to string construction using CacheKeyBuilder if possible or just use string template for now but use CacheConfig.
		const cacheKey = `trending_feed:${page}:${limit}`;

		let cached = await this.redisService.getWithTags<CoreFeed>(cacheKey);
		const isCacheHit = !!cached;
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getTrendingFeed(limit, skip, { timeWindowDays: 14, minLikes: 1 });
			await this.redisService.setWithTags(
				cacheKey,
				core,
				["trending_feed", `page:${page}`, `limit:${limit}`],
				CacheConfig.FEED.TRENDING_FEED,
			);
			cached = core as CoreFeed;
		}
		const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(cached.data, {
			refreshUserData: isCacheHit,
		});
		return { ...cached, data: this.mapToPostDTOArray(enriched) };
	}

	/**
	 * Retrieves a feed of the newest posts, sorted by creation date.
	 *
	 * @pattern Chronological Feed
	 * @caching Short TTL (60s)
	 * @why This feed moves extremely fast. We use a short cache TTL to balance
	 * database load with near-real-time freshness.
	 *
	 * @param page - The page number.
	 * @param limit - Items per page.
	 * @param forceRefresh - If true, bypasses cache and fetches fresh data (for authenticated users).
	 * @returns {Promise<PaginationResult<PostDTO>>}
	 */
	public async getNewFeed(page: number, limit: number, forceRefresh = false): Promise<PaginationResult<PostDTO>> {
		const key = CacheKeyBuilder.getCoreFeedKey("new_feed", page, limit);

		let cached: CoreFeed | null = null;
		if (!forceRefresh) {
			cached = await this.redisService.getWithTags<CoreFeed>(key);
		}

		const isCacheHit = !!cached;
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getNewFeed(limit, skip);
			await this.redisService.setWithTags(
				key,
				core,
				["new_feed", `page:${page}`, `limit:${limit}`],
				CacheConfig.FEED.NEW_FEED,
			);
			cached = core as CoreFeed;
		}
		const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(cached.data, {
			refreshUserData: isCacheHit,
		});
		return { ...cached, data: this.mapToPostDTOArray(enriched) };
	}

	// === Misc ===

	/**
	 * Maps internal FeedPost structures to public DTOs.
	 * @private
	 */
	private mapToPostDTOArray(entries: FeedPost[]): PostDTO[] {
		return entries.map((entry) => this.dtoService.toPostDTO(this.ensurePlain(entry)));
	}

	/**
	 * Utility to ensure Mongoose documents are converted to plain objects.
	 * @private
	 */
	private ensurePlain(entry: any): FeedPost {
		if (entry && typeof entry.toObject === "function") {
			return entry.toObject() as FeedPost;
		}
		return entry as FeedPost;
	}

	/**
	 * Records a user interaction and triggers necessary invalidations.
	 *
	 * @pattern Write-Behind / Async Invalidation
	 * @strategy Eventual Consistency
	 * @why When a user interacts, we immediately log the action and invalidate
	 * relevant caches to reflect the change. We also push to Redis Pub/Sub for real-time
	 * UI updates, ensuring the user feels "instant" feedback.
	 *
	 * @param userPublicId - The user performing the action.
	 * @param actionType - "like", "comment", etc.
	 * @param targetIdentifier - The post or entity being acted upon.
	 * @param tags - Tags associated with the content (for preference learning).
	 */
	public async recordInteraction(
		userPublicId: string,
		actionType: string,
		targetIdentifier: string,
		tags: string[],
	): Promise<void> {
		logger.info(
			`Running recordInteraction... for ${userPublicId}, actionType: ${actionType}, targetId: ${targetIdentifier}, tags: ${tags}`,
		);
		// Resolve user internal id
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");

		// If action targets a post provided by publicId - normalize
		let internalTargetId = targetIdentifier;
		if (
			actionType === "like" ||
			actionType === "unlike" ||
			actionType === "comment" ||
			actionType === "comment_deleted"
		) {
			const sanitized = targetIdentifier.replace(/\.[a-z0-9]{2,5}$/i, "");
			const post = await this.postRepository.findByPublicId(sanitized);
			if (post) internalTargetId = String(post._id);
		}

		// Log to user activity collection
		await this.userActionRepository.logAction(String(user._id), actionType, internalTargetId);

		let scoreIncrement = 0;
		if (actionType === "like" || actionType === "unlike") {
			scoreIncrement = this.getScoreIncrementForAction(actionType);
		}

		// Update tag preferences based on action type (like: +2, unlike: -2)
		if (scoreIncrement !== 0) {
			await Promise.all(
				tags.map((tag) => this.userPreferenceRepository.incrementTagScore(String(user._id), tag, scoreIncrement)),
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
			}),
		);

		logger.info("Feed invalidation completed for user interaction");
	}

	//=== Post Meta Update Operations ===

	/**
	 * Updates the cached metadata for a post's like count.
	 *
	 * @pattern Partial Cache Update
	 * @why High-velocity counters (likes on a viral post) shouldn't trigger a full
	 * feed rebuild. We update the specific metadata key (`post_meta:ID`) in place.
	 *
	 * @param postPublicId - The public ID of the post.
	 * @param newTotalLikes - The new count.
	 */
	public async updatePostLikeMeta(postPublicId: string, newTotalLikes: number): Promise<void> {
		const metaKey = `post_meta:${postPublicId}`;
		const tags = [`post_meta:${postPublicId}`, `post_likes:${postPublicId}`];

		// Get existing meta to preserve other fields (commentsCount, viewsCount)
		const existingMeta = (await this.redisService.getWithTags(metaKey)) || {};

		// Update cached meta with new likes count while preserving other fields
		await this.redisService.setWithTags(
			metaKey,
			{
				...existingMeta,
				likes: newTotalLikes,
			},
			tags,
			300,
		);

		// Broadcast to all connected clients
		await this.redisService.publish(
			"feed_updates",
			JSON.stringify({
				type: "like_update",
				postId: postPublicId,
				newLikes: newTotalLikes,
				timestamp: new Date().toISOString(),
			}),
		);
	}

	/**
	 * Updates the cached metadata for a post's view count.
	 * @pattern Partial Cache Update
	 */
	public async updatePostViewMeta(postPublicId: string, newViewsCount: number): Promise<void> {
		const metaKey = `post_meta:${postPublicId}`;
		const tags = [`post_meta:${postPublicId}`, `post_views:${postPublicId}`];

		// Get existing meta to preserve other fields (likes, commentsCount)
		const existingMeta = (await this.redisService.getWithTags(metaKey)) || {};

		// Update cached meta with new views count while preserving other fields
		await this.redisService.setWithTags(
			metaKey,
			{
				...existingMeta,
				viewsCount: newViewsCount,
			},
			tags,
			300,
		);
	}

	/**
	 * Updates the cached metadata for a post's comment count.
	 * @pattern Partial Cache Update
	 */
	public async updatePostCommentMeta(postPublicId: string, newCommentsCount: number): Promise<void> {
		const metaKey = `post_meta:${postPublicId}`;
		const tags = [`post_meta:${postPublicId}`, `post_comments:${postPublicId}`];

		// Get existing meta to preserve other fields (likes, viewsCount)
		const existingMeta = (await this.redisService.getWithTags(metaKey)) || {};

		// Update cached meta with new comments count while preserving other fields
		await this.redisService.setWithTags(
			metaKey,
			{
				...existingMeta,
				commentsCount: newCommentsCount,
			},
			tags,
			300,
		);
	}

	/**
	 * Helper to map action types to score values.
	 * @private
	 */
	private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
		const scoreMap: Record<"like" | "unlike", number> = {
			like: 2,
			unlike: -2,
		};
		return scoreMap[actionType] ?? 0;
	}

	// === Batch Feed Operations (for post creatring and deleting posts) ===

	/**
	 * Pushes a new post to all followers' feeds.
	 *
	 * @pattern Fan-Out On Write (Push Model)
	 * @complexity O(M) where M is the number of followers.
	 * @why Pre-computing the feed at write time ensures that `getFeed` remains O(1)
	 * for the reader. This shifts the computational cost to the writer (async),
	 * which is generally preferred in read-heavy social applications.
	 *
	 * @param postId - ID of the new post.
	 * @param authorId - Public ID of the author.
	 * @param timestamp - Epoch time of creation (used for sorting).
	 */
	public async fanOutPostToFollowers(postId: string, authorId: string, timestamp: number): Promise<void> {
		logger.info(`Fanning out post ${postId} from author ${authorId} to followers`);

		try {
			const author = await this.userRepository.findByPublicId(authorId);
			if (!author) {
				console.warn(`Author ${authorId} not found, skipping fan-out`);
				return;
			}

			const followerIds = await this.followRepository.getFollowerPublicIdsByPublicId(authorId);
			if (followerIds.length === 0) {
				logger.info(`Author ${authorId} has no followers, skipping fan-out`);
				return;
			}

			// add post to all followers' for_you feeds
			await this.redisService.addToFeedsBatch(followerIds, postId, timestamp, "for_you");
			logger.info(`Fanned out post ${postId} to ${followerIds.length} followers`);
		} catch (error) {
			console.error(`Failed to fan out post ${postId}:`, error);
			// non-fatal, feeds will rebuild on next read
		}
	}

	/**
	 * Removes a deleted post from all followers' feeds.
	 *
	 * @pattern Fan-Out Delete
	 * @why Ensures users don't see "Content Not Found" errors in their feed.
	 *
	 * @param postId - ID of the post to remove.
	 * @param authorId - Public ID of the author.
	 */
	public async removePostFromFollowers(postId: string, authorId: string): Promise<void> {
		logger.info(`Removing post ${postId} from followers of ${authorId}`);

		try {
			const author = await this.userRepository.findByPublicId(authorId);
			if (!author) return;

			const followerIds = await this.followRepository.getFollowerPublicIdsByPublicId(authorId);
			if (followerIds.length === 0) return;

			await this.redisService.removeFromFeedsBatch(followerIds, postId, "for_you");
			logger.info(`Removed post ${postId} from ${followerIds.length} followers' feeds`);
		} catch (error) {
			console.error(`Failed to remove post ${postId} from feeds:`, error);
		}
	}

	/**
	 * Pre-warms the cache for the "New" feed to avoid cold starts.
	 * Should be called by background worker every hour.
	 *
	 * @pattern Warm Cache Strategy
	 * @why Anonymous users shouldn't wait 5s for DB query. We pre-calculate
	 * the feed before anyone requests it, so reads are always from cache.
	 */
	public async prewarmNewFeed(): Promise<void> {
		logger.info("Pre-warming New feed cache...");
		try {
			// prewarm first 3 pages (most commonly accessed)
			const limit = 20;
			for (let page = 1; page <= 3; page++) {
				const key = `new_feed:${page}:${limit}`;
				const skip = (page - 1) * limit;
				const core = await this.postRepository.getNewFeed(limit, skip);
				// 1 hour TTL to match worker schedule
				await this.redisService.setWithTags(key, core, ["new_feed", `page:${page}`, `limit:${limit}`], 3600);
				logger.info(`Pre-warmed New feed page ${page}`);
			}
			logger.info("New feed cache pre-warming complete");
		} catch (error) {
			logger.error("Failed to pre-warm New feed cache", { error });
		}
	}
}
