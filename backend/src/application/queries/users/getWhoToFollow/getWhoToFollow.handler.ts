import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetWhoToFollowQuery } from "./getWhoToFollow.query";
import { inject, injectable } from "tsyringe";
import { IUserReadRepository } from "../../../../repositories/interfaces";
import { RedisService } from "../../../../services/redis.service";
import { createError } from "../../../../utils/errors";
import { logger } from "../../../../utils/winston";

export interface SuggestedUser {
	publicId: string;
	username: string;
	avatar: string;
	bio?: string;
	followerCount: number;
	postCount: number;
	totalLikes: number;
	score: number;
}

export interface GetWhoToFollowResult {
	suggestions: SuggestedUser[];
	cached: boolean;
	timestamp: string;
}

@injectable()
export class GetWhoToFollowQueryHandler implements IQueryHandler<GetWhoToFollowQuery, GetWhoToFollowResult> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("RedisService") private readonly redisService: RedisService
	) {}

	async execute(query: GetWhoToFollowQuery): Promise<GetWhoToFollowResult> {
		try {
			const cacheKey = `who_to_follow:${query.userPublicId}:limit:${query.limit}`;
			const tags = ["who_to_follow", `user_suggestions:${query.userPublicId}`];

			// try to get from cache
			const cached = await this.redisService.getWithTags<GetWhoToFollowResult>(cacheKey);
			if (cached) {
				logger.info("Who to follow cache hit");
				return { ...cached, cached: true };
			}

			// get current user's internal ID
			const currentUser = await this.userReadRepository.findByPublicId(query.userPublicId);
			if (!currentUser) {
				throw createError("NotFoundError", "User not found");
			}

			// get suggestions from aggregation
			const suggestions = await this.userReadRepository.getSuggestedUsersToFollow(String(currentUser._id), query.limit);

			const result: GetWhoToFollowResult = {
				suggestions,
				cached: false,
				timestamp: new Date().toISOString(),
			};

			// cache for 30 minutes (1800 seconds)
			await this.redisService.setWithTags(cacheKey, result, tags, 1800);

			logger.info(`Generated who to follow suggestions for user ${query.userPublicId}`);
			return result;
		} catch (error) {
			console.error("Error in GetWhoToFollowQueryHandler:", error);
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			}
			throw createError("UnknownError", "Failed to get user suggestions");
		}
	}
}
