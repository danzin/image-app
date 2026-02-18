import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetPersonalizedFeedQuery } from "./getPersonalizedFeed.query";
import { RedisService } from "@/services/redis.service";
import { createError } from "@/utils/errors";
import { CoreFeed, FeedPost, PaginatedFeedResult } from "@/types";
import { logger } from "@/utils/winston";
import { FeedEnrichmentService } from "@/services/feed-enrichment.service";
import { FeedCoreService } from "@/services/feed-core.service";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";

@injectable()
export class GetPersonalizedFeedQueryHandler implements IQueryHandler<GetPersonalizedFeedQuery, any> {
	constructor(
		@inject("RedisService") private redisService: RedisService,
		@inject("FeedEnrichmentService") private feedEnrichmentService: FeedEnrichmentService,
		@inject("FeedCoreService") private readonly feedCoreService: FeedCoreService,
	) {}

	async execute(query: GetPersonalizedFeedQuery): Promise<PaginatedFeedResult> {
		const { userId, page, limit } = query;
		logger.info(`Running partitioned getPersonalizedFeed for userId: ${userId}`);
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

		try {
			// Get core feed structure (post IDs and order)
			const coreFeedKey = CacheKeyBuilder.getCoreFeedKey(userId, safePage, safeLimit);
			let coreFeed = (await this.redisService.getWithTags(coreFeedKey)) as CoreFeed | null;

			if (!coreFeed) {
				// cache miss - generate core feed
				logger.info("Core feed cache miss, generating...");
				coreFeed = await this.feedCoreService.generatePersonalizedCoreFeed(userId, safePage, safeLimit);

				// store in redis with tags for smart invalidation
				const tags = [
					CacheKeyBuilder.getUserFeedTag(userId),
					CacheKeyBuilder.getFeedPageTag(safePage),
					CacheKeyBuilder.getFeedLimitTag(safeLimit),
				];
				await this.redisService.setWithTags(coreFeedKey, coreFeed, tags, 300); // 5 minutes
			} else {
				logger.info("Core feed cache hit");
			}

			// Enrich core feed with fresh user data
			const enrichedFeed: FeedPost[] = await this.feedEnrichmentService.enrichFeedWithCurrentData(coreFeed.data);

			return {
				...coreFeed,
				data: enrichedFeed,
				page: coreFeed.page ?? safePage,
				total: coreFeed.total ?? 0,
				totalPages: coreFeed.totalPages ?? 0,
			};
		} catch (error) {
			console.error("Failed to generate personalized feed:", error);
			throw createError(
				"UnknownError",
				`Could not generate personalized feed for user ${userId}: ${(error as Error).message}`,
			);
		}
	}
}
