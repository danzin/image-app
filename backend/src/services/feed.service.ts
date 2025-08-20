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
			let coreFeed = await this.redisService.get(coreFeedKey);

			if (!coreFeed) {
				console.log("Core feed cache miss, generating...");
				coreFeed = await this.generateCoreFeed(userId, page, limit);
				await this.redisService.set(coreFeedKey, coreFeed, 300); // 5 minutes
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
				console.log("Returning cached feed");
				return cachedFeed;
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
			return feed;
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

		// Get current user data
		const userDataKey = `user_batch:${userPublicIds.sort().join(",")}`;
		let userData = await this.redisService.get(userDataKey);

		if (!userData) {
			userData = await this.userRepository.findUsersByPublicIds(userPublicIds);
			await this.redisService.set(userDataKey, userData, 60); // 1 minute cache
		}

		const userMap = new Map<string, UserLookupData>(userData.map((user: UserLookupData) => [user.publicId, user]));

		// Enrich each feed item with current user data
		return coreFeedData.map((item) => ({
			...item,
			user: {
				publicId: userMap.get(item.userPublicId)?.publicId,
				username: userMap.get(item.userPublicId)?.username,
				avatar: userMap.get(item.userPublicId)?.avatar,
			},
		}));
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
		console.log("Removing cache");
		await this.redisService.del(`feed:${userPublicId}:*`);
	}

	private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
		const scoreMap: Record<"like" | "unlike", number> = {
			like: 2,
			unlike: -2,
		};
		return scoreMap[actionType] ?? 0;
	}
}
