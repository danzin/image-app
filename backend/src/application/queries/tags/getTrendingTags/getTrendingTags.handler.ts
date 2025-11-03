import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetTrendingTagsQuery } from "./getTrendingTags.query";
import { inject, injectable } from "tsyringe";
import { RedisService } from "../../../../services/redis.service";
import { PostRepository } from "../../../../repositories/post.repository";
import { createError } from "../../../../utils/errors";
import { GetTrendingTagsResult, TrendingTag } from "types/index";

@injectable()
export class GetTrendingTagsQueryHandler implements IQueryHandler<GetTrendingTagsQuery, GetTrendingTagsResult> {
	private readonly CACHE_KEY_PREFIX = "trending_tags";
	private readonly CACHE_TTL = 900; // 15 minutes – balances freshness with expensive aggregation

	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("RedisService") private readonly redisService: RedisService
	) {}

	async execute(query: GetTrendingTagsQuery): Promise<GetTrendingTagsResult> {
		try {
			const limit = Math.min(Math.max(query.limit ?? 5, 1), 20);
			const timeWindowHours = Math.max(1, query.timeWindowHours ?? 168);
			const cacheKey = `${this.CACHE_KEY_PREFIX}:${limit}:${timeWindowHours}`;
			// try to get from cache first
			const cached = await this.redisService.get<GetTrendingTagsResult>(cacheKey);
			if (cached) {
				console.log("[GetTrendingTagsQuery] Returning cached trending tags");
				return cached;
			}

			// if not in cache, compute trending tags
			const tags = await this.computeTrendingTags(limit, timeWindowHours);

			const result: GetTrendingTagsResult = { tags };

			// cache the result for a short window since aggregation touches many posts
			await this.redisService.set(cacheKey, result, this.CACHE_TTL);

			console.log(`[GetTrendingTagsQuery] Computed and cached ${tags.length} trending tags`);
			return result;
		} catch (error) {
			console.error("[GetTrendingTagsQuery] Error:", error);
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			}
			throw createError("UnknownError", "An unknown error occurred while fetching trending tags");
		}
	}

	/**
	 * Invalidate the trending tags cache when new posts with tags are created
	 */
	async invalidateCache(): Promise<void> {
		try {
			const deleted = await this.redisService.del(`${this.CACHE_KEY_PREFIX}:*`);
			console.log(`[GetTrendingTagsQuery] Cache invalidated (keys deleted: ${deleted})`);
		} catch (error) {
			console.error("[GetTrendingTagsQuery] Failed to invalidate cache:", error);
		}
	}

	/**
	 * computes trending tags based on:
	 * 1. recent activity (modifiedAt within time window)
	 * 2. total post count (count field)
	 * sorts by recency and popularity
	 */
	private async computeTrendingTags(limit: number, timeWindowHours: number): Promise<TrendingTag[]> {
		const trendingTags = await this.postRepository.getTrendingTags(limit, timeWindowHours);

		console.log(`[GetTrendingTagsQuery] Found ${trendingTags.length} trending tags`);
		if (trendingTags.length > 0) {
			console.log(`[GetTrendingTagsQuery] Top tag: ${trendingTags[0].tag} (count: ${trendingTags[0].count})`);
		}

		return trendingTags;
	}
}
