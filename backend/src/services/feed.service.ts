import { inject, injectable } from "tsyringe";
import { PostRepository } from "../repositories/post.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { FollowRepository } from "../repositories/follow.repository";
import { createError } from "../utils/errors";
import { RedisService } from "./redis.service";
import { DTOService } from "./dto.service";
import { EventBus } from "../application/common/buses/event.bus";
import { PaginationResult, PostDTO, UserLookupData, FeedPost, PostMeta, CoreFeed } from "../types";
import { ColdStartFeedGeneratedEvent } from "../application/events/ColdStartFeedGenerated.event";

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
		@inject("EventBus") private eventBus: EventBus
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
		console.log(`Running partitioned getPersonalizedFeed for userId: ${userId}`);

		try {
			// STEP 1: Get core feed structure (post IDs and order)
			const coreFeedKey = `core_feed:${userId}:${page}:${limit}`;
			let coreFeed = await this.redisService.getWithTags<CoreFeed>(coreFeedKey);
			const isCacheHit = !!coreFeed; // convert the result of the lookup to boolean

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

			// SSTEP2:  Enrich core feed with fresh user data, but only
			const enrichedFeed = await this.enrichFeedWithCurrentData(coreFeed.data, { refreshUserData: isCacheHit });

			return {
				...coreFeed,
				data: this.mapToPostDTOArray(enrichedFeed),
			};
		} catch (error) {
			console.error("Failed to generate personalized feed:", error);
			throw createError(
				"UnknownError",
				`Could not generate personalized feed for user ${userId}: ${(error as Error).message}`
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
		const key = `trending_feed:${page}:${limit}`;
		let cached = await this.redisService.getWithTags<CoreFeed>(key);
		const isCacheHit = !!cached;
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getTrendingFeed(limit, skip, { timeWindowDays: 14, minLikes: 1 });
			await this.redisService.setWithTags(key, core, ["trending_feed", `page:${page}`, `limit:${limit}`], 120);
			cached = core as CoreFeed;
		}
		const enriched = await this.enrichFeedWithCurrentData(cached.data, { refreshUserData: isCacheHit });
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
	 * @returns {Promise<PaginationResult<PostDTO>>}
	 */
	public async getNewFeed(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const key = `new_feed:${page}:${limit}`;
		let cached = await this.redisService.getWithTags<CoreFeed>(key);
		const isCacheHit = !!cached;
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getNewFeed(limit, skip);
			await this.redisService.setWithTags(key, core, ["new_feed", `page:${page}`, `limit:${limit}`], 60);
			cached = core as CoreFeed;
		}
		const enriched = await this.enrichFeedWithCurrentData(cached.data, { refreshUserData: isCacheHit });
		return { ...cached, data: this.mapToPostDTOArray(enriched) };
	}

	// === Misc ===

	/**
	 * Hydrates a list of FeedPosts with fresh User and Meta data.
	 *
	 * @pattern Read-Time Hydration
	 * @complexity O(N) where N is feed size (uses batched lookups).
	 * @why This is the "Enrichment Layer". It allows the "Core Feed" to remain static
	 * while ensuring that high-velocity data (Like Counts) and mutable data (Avatars)
	 * are always current.
	 *
	 * @private
	 * @param coreFeedData - The core feed structure containing post IDs and user IDs.
	 * @param options - Options to control data refreshing.
	 * @returns {Promise<FeedPost[]>} A list of enriched feed posts.
	 */
	private async enrichFeedWithCurrentData(
		coreFeedData: FeedPost[],
		options: { refreshUserData: boolean } = { refreshUserData: true }
	): Promise<FeedPost[]> {
		if (!coreFeedData || coreFeedData.length === 0) return [];

		const postPublicIds = [...new Set(coreFeedData.map((item) => item.publicId).filter(Boolean))];
		let userMap = new Map<string, UserLookupData>();

		if (options.refreshUserData) {
			// Extract unique user publicIds from feed items
			const userPublicIds = [...new Set(coreFeedData.map((item) => item.userPublicId))];

			// Batch fetch user data with tag-based caching
			const userDataKey = `user_batch:${userPublicIds.sort().join(",")}`;
			let userData = await this.redisService.getWithTags<UserLookupData[]>(userDataKey);

			if (!userData) {
				userData = await this.userRepository.findUsersByPublicIds(userPublicIds);
				// Cache with user-specific tags for avatar invalidation
				const userTags = userPublicIds.map((id) => `user_data:${id}`);
				await this.redisService.setWithTags(userDataKey, userData, userTags, 60); // 1 minute cache
			}

			userMap = new Map<string, UserLookupData>(userData.map((user: UserLookupData) => [user.publicId, user]));
		}

		// Attempt to load post meta with tag-based caching
		const postMetaKeys = postPublicIds.map((id) => `post_meta:${id}`);
		const metaResults = await Promise.all(
			postMetaKeys.map((k) => this.redisService.getWithTags<PostMeta>(k).catch(() => null))
		);
		const metaMap = new Map<string, PostMeta>();
		postPublicIds.forEach((id, idx) => {
			if (metaResults[idx]) metaMap.set(id, metaResults[idx]!);
		});

		// Merge fresh user/image data into core feed
		return coreFeedData.map((item) => {
			const meta = metaMap.get(item.publicId);
			const enriched: FeedPost = {
				...item,
				likes: meta?.likes ?? item.likes,
				commentsCount: meta?.commentsCount ?? item.commentsCount,
				viewsCount: meta?.viewsCount ?? item.viewsCount,
				user: options.refreshUserData
					? {
							publicId: userMap.get(item.userPublicId)?.publicId ?? item.user.publicId,
							username: userMap.get(item.userPublicId)?.username ?? item.user.username,
							avatar: userMap.get(item.userPublicId)?.avatar ?? item.user.avatar,
						}
					: item.user,
			};
			console.log(`[FeedService] Enriched post ${item.publicId}:`, {
				viewsCount: enriched.viewsCount,
				commentsCount: enriched.commentsCount,
				likes: enriched.likes,
			});
			return enriched;
		});
	}

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
		tags: string[]
	): Promise<void> {
		console.log(
			`Running recordInteraction... for ${userPublicId}, actionType: ${actionType}, targetId: ${targetIdentifier}, tags: ${tags}`
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
			300
		);

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
			300
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
			300
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
		console.log(`Fanning out post ${postId} from author ${authorId} to followers`);

		try {
			const author = await this.userRepository.findByPublicId(authorId);
			if (!author) {
				console.warn(`Author ${authorId} not found, skipping fan-out`);
				return;
			}

			const followerIds = await this.followRepository.getFollowerPublicIdsByPublicId(authorId);
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
	 * Removes a deleted post from all followers' feeds.
	 *
	 * @pattern Fan-Out Delete
	 * @why Ensures users don't see "Content Not Found" errors in their feed.
	 *
	 * @param postId - ID of the post to remove.
	 * @param authorId - Public ID of the author.
	 */
	public async removePostFromFollowers(postId: string, authorId: string): Promise<void> {
		console.log(`Removing post ${postId} from followers of ${authorId}`);

		try {
			const author = await this.userRepository.findByPublicId(authorId);
			if (!author) return;

			const followerIds = await this.followRepository.getFollowerPublicIdsByPublicId(authorId);
			if (followerIds.length === 0) return;

			await this.redisService.removeFromFeedsBatch(followerIds, postId, "for_you");
			console.log(`Removed post ${postId} from ${followerIds.length} followers' feeds`);
		} catch (error) {
			console.error(`Failed to remove post ${postId} from feeds:`, error);
		}
	}
}
