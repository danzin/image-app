import { inject, injectable } from "tsyringe";
import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { RedisService } from "./redis.service";
import { IUser } from "../types";

@injectable()
export class FeedService {
	constructor(
		@inject("ImageRepository") private imageRepository: ImageRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
		@inject("UserActionRepository") private userActionRepository: UserActionRepository,
		@inject("RedisService") private redisService: RedisService
	) {}

	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<any> {
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
			const feed = await this.imageRepository.getFeedForUser(followingIds, favoriteTags, limit, skip);

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

	public async recordInteraction(userId: string, actionType: string, targetId: string, tags: string[]): Promise<void> {
		console.log(`Running recordInteraction... for ${userId}, actionType: ${actionType}, \r\n 
      targetId: ${targetId}, tags: ${tags}`);

		// Get user's MongoDB ID from their public ID
		const user = await this.userRepository.findByPublicId(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		// Record the action using MongoDB ID
		await this.userActionRepository.logAction(String(user._id), actionType, targetId);

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
		await this.redisService.del(`feed:${userId}:*`);
	}

	private getScoreIncrementForAction(actionType: "like" | "unlike"): number {
		const scoreMap: Record<"like" | "unlike", number> = {
			like: 2,
			unlike: -2,
		};
		return scoreMap[actionType] ?? 0;
	}
}
