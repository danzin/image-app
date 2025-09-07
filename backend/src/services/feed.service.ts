import { inject, injectable } from "tsyringe";
import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { RedisService } from "./redis.service";
import { IUser, UserLookupData } from "../types";
import { EventBus } from "../application/common/buses/event.bus";

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

	public async getPersonalizedFeedLegacy(userId: string, page: number, limit: number): Promise<any> {
		return this.getPersonalizedFeedOriginal(userId, page, limit);
	}

	// New partitioned implementation
	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<any> {
		console.log(`Running partitioned getPersonalizedFeed for userId: ${userId}`);

		try {
			// STEP 1: Get core feed structure (image IDs and order)
			const coreFeedKey = `core_feed:${userId}:${page}:${limit}`;
			let coreFeed = await this.redisService.getWithTags(coreFeedKey);

			if (!coreFeed) {
				console.log("Core feed cache miss, generating...");
				coreFeed = await this.generateCoreFeed(userId, page, limit);

				// Cache with tags for smart invalidation
				const tags = [`user_feed:${userId}`, `feed_page:${page}`, `feed_limit:${limit}`];
				await this.redisService.setWithTags(coreFeedKey, coreFeed, tags, 300); // 5 minutes
			} else {
				console.log("Core feed cache hit");
			}

			// Enrich core feed with fresh user data
			const enrichedFeed = await this.enrichFeedWithCurrentData(coreFeed.data);

			return {
				...coreFeed,
				data: enrichedFeed,
			};
		} catch (error) {
			console.error("Partitioned feed error, falling back to legacy:", error);
			// Fallback to previous working implementation
			return this.getPersonalizedFeedLegacy(userId, page, limit);
		}
	}

	// Legacy implementation, keeping it as a fallback
	private async getPersonalizedFeedOriginal(userId: string, page: number, limit: number): Promise<any> {
		console.log(`Running getPersonalizedFeed for userId: ${userId} `);
		try {
			const cacheKey = `feed:${userId}:${page}:${limit}`;

			// Check cache first
			const cachedFeed = await this.redisService.get(cacheKey);
			if (cachedFeed) {
				console.log("Returning cached legacy feed (no dynamic enrichment, fallback mode)");
				return cachedFeed; // legacy path stays simple
			}

			//Using Promise.all to execute the operations concurrently and
			// get the result once they've resolved or rejected
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
			console.log(
				`==================followingIds: ${followingIds}, favoriteTags: ${favoriteTags} \r\n =======================`
			);
			const feed = await this.imageRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip);
			await this.redisService.set(cacheKey, feed, 120); // Cache feed for 2 minutes
			return feed; // return raw feed as legacy fallback
		} catch (error) {
			console.error(error);
			const errorMessage =
				typeof error === "object" && error !== null && "message" in error
					? (error as { message?: string }).message || "Unknown error"
					: String(error);
			throw createError("FeedError", errorMessage);
		}
	}

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

		// Use the new core method that returns userPublicId instead of ObjectId
		const feed = await this.imageRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip);

		return feed;
	}

	private async enrichFeedWithCurrentData(coreFeedData: any[]): Promise<any[]> {
		if (!coreFeedData || coreFeedData.length === 0) return [];

		// Extract unique user publicIds
		const userPublicIds = [...new Set(coreFeedData.map((item) => item.userPublicId))];
		const imagePublicIds = [...new Set(coreFeedData.map((item) => item.publicId).filter(Boolean))];

		// Get current user data with tag-based caching
		const userDataKey = `user_batch:${userPublicIds.sort().join(",")}`;
		let userData = await this.redisService.getWithTags(userDataKey);

		if (!userData) {
			userData = await this.userRepository.findUsersByPublicIds(userPublicIds);
			// Cache with user-specific tags for avatar invalidation
			const userTags = userPublicIds.map((id) => `user_data:${id}`);
			await this.redisService.setWithTags(userDataKey, userData, userTags, 60); // 1 minute cache
		}

		const userMap = new Map<string, UserLookupData>(userData.map((user: UserLookupData) => [user.publicId, user]));

		// Attempt to load per-image meta with tag-based caching
		const imageMetaKeys = imagePublicIds.map((id) => `image_meta:${id}`);
		const metaResults = await Promise.all(imageMetaKeys.map((k) => this.redisService.getWithTags(k).catch(() => null)));
		const metaMap = new Map<string, any>();
		imagePublicIds.forEach((id, idx) => {
			if (metaResults[idx]) metaMap.set(id, metaResults[idx]);
		});

		// Enrich each feed item with current user data + dynamic meta overrides
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
		if (actionType === "like" || actionType === "unlike") {
			const sanitized = targetIdentifier.replace(/\.[a-z0-9]{2,5}$/i, "");
			const image = await this.imageRepository.findByPublicId(sanitized);
			if (image) internalTargetId = (image as any)._id.toString();
		}
		await this.userActionRepository.logAction(String(user._id), actionType, internalTargetId);

		// Update tag preferences based on action type
		let scoreIncrement = 0;
		if (actionType === "like" || actionType === "unlike") {
			scoreIncrement = this.getScoreIncrementForAction(actionType);
		}

		if (scoreIncrement !== 0) {
			await Promise.all(
				tags.map((tag) => this.userPreferenceRepository.incrementTagScore(String(user._id), tag, scoreIncrement))
			);
		}

		// Smart invalidation: only invalidate affected feeds
		const invalidationTags = [`user_feed:${userPublicId}`];
		await this.redisService.invalidateByTags(invalidationTags);

		// Publish real-time update via Redis pub/sub
		await this.redisService.publish("feed_updates", {
			type: "interaction",
			userId: userPublicId,
			actionType,
			targetId: targetIdentifier,
			tags,
			timestamp: new Date().toISOString(),
		});

		console.log("Smart cache invalidation completed for user interaction");
	}

	/**
	 * Update per-image meta cache after like/unlike without regenerating entire feed partition.
	 */
	public async updateImageLikeMeta(imagePublicId: string, newTotalLikes: number): Promise<void> {
		const metaKey = `image_meta:${imagePublicId}`;
		const tags = [`image_meta:${imagePublicId}`, `image_likes:${imagePublicId}`];
		await this.redisService.setWithTags(metaKey, { likes: newTotalLikes }, tags, 300);

		// Publish real-time like update
		await this.redisService.publish("feed_updates", {
			type: "like_update",
			imageId: imagePublicId,
			newLikes: newTotalLikes,
			timestamp: new Date().toISOString(),
		});
	}

	private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
		const scoreMap: Record<"like" | "unlike", number> = {
			like: 2,
			unlike: -2,
		};
		return scoreMap[actionType] ?? 0;
	}
}
