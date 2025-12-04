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
 * @description Manages the generation and delivery of various types of feeds,
 * such as personalized, trending, and new feeds. It uses a two-layer approach
 * (core feed and enrichment) to efficiently build and cache feeds. This service
 * is responsible for pre-computing feeds ("fanout on write") for followers and
 * handling real-time updates.
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
	 * @description Generates a personalized feed for a user based on their followings and interests.
	 * Implements a two-layer caching strategy:
	 * 1.  **Core Feed:** Caches the basic structure (post IDs and order).
	 * 2.  **Enrichment:** Fetches and caches fresh user and post metadata, which is then merged
	 *     with the core feed. This separation prevents rebuilding the entire feed for minor
	 *     updates like an avatar change.
	 *
	 * @param {string} userId - The public ID of the user requesting the feed.
	 * @param {number} page - The page number for pagination.
	 * @param {number} limit - The number of items per page.
	 * @returns {Promise<PaginationResult<PostDTO>>} A paginated list of enriched post DTOs.
	 * @throws {UnknownError} If the feed generation fails for any reason.
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
	 * @description Generates the core structure of a user's feed.
	 * If the user is new (no followers or favorite tags), it returns a "discovery" feed of new posts.
	 * If the user has established preferences, it builds a feed from posts by users they follow
	 * and posts matching their favorite tags.
	 * For new users, it also publishes a `ColdStartFeedGeneratedEvent`.
	 *
	 * @private
	 * @param {string} userId - The public ID of the user.
	 * @param {number} page - The page number for pagination.
	 * @param {number} limit - The number of items per page.
	 * @returns {Promise<CoreFeed>} The core feed structure, containing post IDs and minimal data.
	 * @throws {NotFoundError} If the user is not found.
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
	 * @description Retrieves a trending feed ranked by popularity and recency
	 * Results are cached to improve performance. The feed is enriched with current user and post
	 * metadata before being returned.
	 *
	 * @param {number} page - The page number for pagination.
	 * @param {number} limit - The number of items per page.
	 * @returns {Promise<PaginationResult<PostDTO>>} A paginated list of trending post DTOs.
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
	 * @description Retrieves a feed of the newest posts, sorted by creation date.
	 * Results are cached briefly. The feed is enriched with current user and post metadata.
	 *
	 * @param {number} page - The page number for pagination.
	 * @param {number} limit - The number of items per page.
	 * @returns {Promise<PaginationResult<PostDTO>>} A paginated list of new post DTOs.
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
	 * @description Enrichment layer that fetches current user data and dynamic post metadata (likes, comments).
	 * This separation of data allows for efficient caching, preventing the need to rebuild the entire
	 * feed for small changes like an avatar update. It conditionally refreshes user data based on
	 * cache status to optimize performance.
	 *
	 * @private
	 * @param {FeedPost[]} coreFeedData - The core feed structure containing post IDs and user IDs.
	 * @param {object} [options={ refreshUserData: true }] - Options to control data refreshing.
	 * @param {boolean} options.refreshUserData - Whether to fetch fresh user data.
	 * @returns {Promise<FeedPost[]>} A list of enriched feed posts with up-to-date metadata.
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
	 * @description Maps an array of `FeedPost` objects to an array of `PostDTO` objects.
	 * @private
	 * @param {FeedPost[]} entries - The array of feed posts to map.
	 * @returns {PostDTO[]} The resulting array of post DTOs.
	 */
	private mapToPostDTOArray(entries: FeedPost[]): PostDTO[] {
		return entries.map((entry) => this.dtoService.toPostDTO(this.ensurePlain(entry)));
	}

	/**
	 * @description Ensures that a given entry is a plain JavaScript object. If the entry is a
	 * Mongoose document with a `toObject` method, it will be converted.
	 * @private
	 * @param {*} entry - The item to process.
	 * @returns {FeedPost} The plain object representation of the entry.
	 */
	private ensurePlain(entry: any): FeedPost {
		if (entry && typeof entry.toObject === "function") {
			return entry.toObject() as FeedPost;
		}
		return entry as FeedPost;
	}

	/**
	 * @description Records a user interaction, updates tag preferences, invalidates relevant caches,
	 * and publishes a real-time event.
	 * @param {string} userPublicId - The public ID of the user performing the action.
	 * @param {string} actionType - The type of action (e.g., "like", "comment").
	 * @param {string} targetIdentifier - The public ID of the target entity (e.g., post).
	 * @param {string[]} tags - An array of tags associated with the target, used for updating preferences.
	 * @returns {Promise<void>}
	 * @throws {NotFoundError} If the user is not found.
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
	 * @description Updates the cached metadata for a post's like count and broadcasts the change
	 * to connected clients for real-time updates.
	 * @param {string} postPublicId - The public ID of the post to update.
	 * @param {number} newTotalLikes - The new total number of likes.
	 * @returns {Promise<void>}
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
	 * @description Updates the cached metadata for a post's view count.
	 * @param {string} postPublicId - The public ID of the post.
	 * @param {number} newViewsCount - The new total view count.
	 * @returns {Promise<void>}
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
	 * @description Updates the cached metadata for a post's comment count.
	 * @param {string} postPublicId - The public ID of the post.
	 * @param {number} newCommentsCount - The new total comment count.
	 * @returns {Promise<void>}
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
	 * @description Determines the scoer increment for a given user action type
	 * @private
	 * @param {"like" | "unlike"} actionType - The type of action performed.
	 * @returns {number} The score increment or decrement. Returns 2 for "like", -2 for "unlike".
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
	 * @description Adds a new post to the feeds of all followers of the author
	 * This fan-out on write approach precomputes the feed for better read performance
	 * @param {string} authorId public ID of the author
	 * @param {string} postId id of the new post
	 * @param {number} timestamp epoch time of post creation
	 * @returns {Promise<void>}
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
	 * @description Removes a deleted post from feeds of all followers of th author
	 * @param {string} postId ID of the post to remove
	 * @param {string} authorId Public ID of the author whose followers' feeds to update
	 * @returns {Promise<void>}
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
