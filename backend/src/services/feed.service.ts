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
import { PaginationResult, PostDTO, UserLookupData } from "../types";
import { ColdStartFeedGeneratedEvent } from "../application/events/ColdStartFeedGenerated.event";

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

	// New partitioned implementation of core feed layer
	// generates personalized feed based on user's following list
	// in 2 layers: Core feed and Enrichment.
	// This way when a user changes avatar, I don't rebuild the whole feed. Just refresh the user data layer

	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<PaginationResult<PostDTO>> {
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

	// The feed builder.
	// New user - Discovery/Trending feed(getRankedFeed)
	// Established user - Images from following + tag preferences (getFeedForUserCore)
	private async generateCoreFeed(userId: string, page: number, limit: number) {
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

			return this.postRepository.getNewFeed(limit, skip);
		}

		return this.postRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip);
	}

	// === Specialized feeds ===

	// Trending - ranked by popularity + recency
	public async getTrendingFeed(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const key = `trending_feed:${page}:${limit}`;
		let cached = await this.redisService.getWithTags(key);
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getTrendingFeed(limit, skip, { timeWindowDays: 14, minLikes: 1 });
			await this.redisService.setWithTags(key, core, ["trending_feed", `page:${page}`, `limit:${limit}`], 120);
			cached = core;
		}
		const enriched = await this.enrichFeedWithCurrentData(cached.data);
		return { ...cached, data: this.mapToPostDTOArray(enriched) };
	}

	// New feed - sorted by recency
	public async getNewFeed(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const key = `new_feed:${page}:${limit}`;
		let cached = await this.redisService.getWithTags(key);
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.postRepository.getNewFeed(limit, skip);
			await this.redisService.setWithTags(key, core, ["new_feed", `page:${page}`, `limit:${limit}`], 60);
			cached = core;
		}
		const enriched = await this.enrichFeedWithCurrentData(cached.data);
		return { ...cached, data: this.mapToPostDTOArray(enriched) };
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

		// Attempt to load post meta with tag-based caching
		const postMetaKeys = postPublicIds.map((id) => `post_meta:${id}`);
		const metaResults = await Promise.all(postMetaKeys.map((k) => this.redisService.getWithTags(k).catch(() => null)));
		const metaMap = new Map<string, any>();
		postPublicIds.forEach((id, idx) => {
			if (metaResults[idx]) metaMap.set(id, metaResults[idx]);
		});

		// Merge fresh user/image data into core feed
		return coreFeedData.map((item) => {
			const meta = metaMap.get(item.publicId);
			const enriched = {
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
			console.log(`[FeedService] Enriched post ${item.publicId}:`, {
				viewsCount: enriched.viewsCount,
				commentsCount: enriched.commentsCount,
				likes: enriched.likes,
			});
			return enriched;
		});
	}

	private mapToPostDTOArray(entries: any[]): PostDTO[] {
		return entries.map((entry) => this.dtoService.toPostDTO(this.ensurePlain(entry)));
	}

	private ensurePlain(entry: any): any {
		if (entry && typeof entry.toObject === "function") {
			return entry.toObject();
		}
		return entry;
	}

	// Real time invalidation
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
			if (post) internalTargetId = (post as any)._id.toString();
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

	/**
	 * Update post meta cache after like/unlike without regenerating entire feed partition.
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
	 * Update post meta meta cache after a view is recorded
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
	 * Update per post meta cache after comment count changes
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

	private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
		const scoreMap: Record<"like" | "unlike", number> = {
			like: 2,
			unlike: -2,
		};
		return scoreMap[actionType] ?? 0;
	}

	// === Batch Feed Operations (for post creatring and deleting posts) ===

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
	 * Remove post from followers' feeds (when user deletes post)
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
