import { inject, injectable } from "tsyringe";
import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { RedisService } from "./redis.service";
import { IUser, UserLookupData } from "../types";
import { EventBus } from "../application/common/buses/event.bus";
import { ColdStartFeedGeneratedEvent } from "../application/events/ColdStartFeedGenerated.event";

@injectable()
export class FeedService {
	constructor(
		@inject("ImageRepository") private imageRepository: ImageRepository,
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
			// STEP 1: Get core feed structure (image IDs and order)
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
				} catch (_) {
					// non-fatal
				}
			}

			return this.imageRepository.getRankedFeed(favoriteTags, limit, skip);
		}

		return this.imageRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip);
	}

	// === Specialized feeds ===

	// For you - personalized recommendations
	public async getForYouFeed(userId: string, page: number, limit: number): Promise<any> {
		console.log(`Running getForYouFeed for userId: ${userId}`);

		try {
			const coreFeedKey = `for_you_feed:${userId}:${page}:${limit}`;
			let coreFeed = await this.redisService.getWithTags(coreFeedKey);

			if (!coreFeed) {
				console.log("For You feed cache miss, generating...");
				coreFeed = await this.generateForYouFeed(userId, page, limit);

				const tags = [`user_for_you_feed:${userId}`, `for_you_feed_page:${page}`, `for_you_feed_limit:${limit}`];
				await this.redisService.setWithTags(coreFeedKey, coreFeed, tags, 300); // 5 minutes
			} else {
				console.log("For You feed cache hit");
			}

			const enrichedFeed = await this.enrichFeedWithCurrentData(coreFeed.data);

			return {
				...coreFeed,
				data: enrichedFeed,
			};
		} catch (error) {
			console.error("For You feed error:", error);
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

		const feed = await this.imageRepository.getRankedFeed(favoriteTags, limit, skip);

		return feed;
	}

	// Trending - ranked by popularity + recency
	public async getTrendingFeed(page: number, limit: number): Promise<any> {
		const key = `trending_feed:${page}:${limit}`;
		let cached = await this.redisService.getWithTags(key);
		if (!cached) {
			const skip = (page - 1) * limit;
			const core = await this.imageRepository.getTrendingFeed(limit, skip, { timeWindowDays: 14, minLikes: 1 });
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
			const core = await this.imageRepository.getNewFeed(limit, skip);
			await this.redisService.setWithTags(key, core, ["new_feed", `page:${page}`, `limit:${limit}`], 60);
			cached = core;
		}
		const enriched = await this.enrichFeedWithCurrentData(cached.data);
		return { ...cached, data: enriched };
	}

	// Enrichment layer - fetch current user data and dynamic meta (likes/comments) with tag-based caching
	private async enrichFeedWithCurrentData(coreFeedData: any[]): Promise<any[]> {
		if (!coreFeedData || coreFeedData.length === 0) return [];

		// Extract unique user publicIds from feed items
		const userPublicIds = [...new Set(coreFeedData.map((item) => item.userPublicId))];
		const imagePublicIds = [...new Set(coreFeedData.map((item) => item.publicId).filter(Boolean))];

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

		// Attempt to load per-image metadata with tag-based caching
		const imageMetaKeys = imagePublicIds.map((id) => `image_meta:${id}`);
		const metaResults = await Promise.all(imageMetaKeys.map((k) => this.redisService.getWithTags(k).catch(() => null)));
		const metaMap = new Map<string, any>();
		imagePublicIds.forEach((id, idx) => {
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

		// If action targets an image provided by publicId (may include extension), normalize
		let internalTargetId = targetIdentifier;
		if (
			actionType === "like" ||
			actionType === "unlike" ||
			actionType === "comment" ||
			actionType === "comment_deleted"
		) {
			const sanitized = targetIdentifier.replace(/\.[a-z0-9]{2,5}$/i, "");
			const image = await this.imageRepository.findByPublicId(sanitized);
			if (image) internalTargetId = (image as any)._id.toString();
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

		// Smart cache invalidation: only clear THIS user's feed
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

		console.log("Smart cache invalidation completed for user interaction");
	}

	/**
	 * Update per-image meta cache after like/unlike without regenerating entire feed partition.
	 */
	public async updateImageLikeMeta(imagePublicId: string, newTotalLikes: number): Promise<void> {
		const metaKey = `image_meta:${imagePublicId}`;
		const tags = [`image_meta:${imagePublicId}`, `image_likes:${imagePublicId}`];

		//Update cached like counts
		await this.redisService.setWithTags(metaKey, { likes: newTotalLikes }, tags, 300);

		// Broadcast to all connected clients
		await this.redisService.publish(
			"feed_updates",
			JSON.stringify({
				type: "like_update",
				imageId: imagePublicId,
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
}
