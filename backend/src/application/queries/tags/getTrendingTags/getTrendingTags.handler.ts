import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetTrendingTagsQuery } from "./getTrendingTags.query";
import { inject, injectable } from "tsyringe";
import { TagRepository } from "../../../../repositories/tag.repository";
import { RedisService } from "../../../../services/redis.service";
import { createError } from "../../../../utils/errors";

export interface TrendingTag {
	tag: string;
	count: number;
	recentPostCount: number;
}

export interface GetTrendingTagsResult {
	tags: TrendingTag[];
}

@injectable()
export class GetTrendingTagsQueryHandler implements IQueryHandler<GetTrendingTagsQuery, GetTrendingTagsResult> {
	private readonly CACHE_KEY = "trending_tags";
	private readonly CACHE_TTL = 300; // 5 minutes (reduced from 1 hour for fresher data)

	constructor(
		@inject("TagRepository") private readonly tagRepository: TagRepository,
		@inject("RedisService") private readonly redisService: RedisService
	) {}

	async execute(query: GetTrendingTagsQuery): Promise<GetTrendingTagsResult> {
		try {
			// try to get from cache first
			const cached = await this.redisService.get<GetTrendingTagsResult>(this.CACHE_KEY);
			if (cached) {
				console.log("[GetTrendingTagsQuery] Returning cached trending tags");
				return cached;
			}

			// if not in cache, compute trending tags
			const tags = await this.computeTrendingTags(query.limit, query.timeWindowHours);

			const result: GetTrendingTagsResult = { tags };

			// cache the result for 1 hour (no invalidation needed)
			await this.redisService.set(this.CACHE_KEY, result, this.CACHE_TTL);

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
			await this.redisService.del(this.CACHE_KEY);
			console.log("[GetTrendingTagsQuery] Cache invalidated");
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
		const timeThreshold = new Date();
		timeThreshold.setHours(timeThreshold.getHours() - timeWindowHours);

		console.log(`[GetTrendingTagsQuery] Computing trending tags:`);
		console.log(`  - Time window: ${timeWindowHours} hours`);
		console.log(`  - Time threshold: ${timeThreshold.toISOString()}`);
		console.log(`  - Limit: ${limit}`);

		// aggregation pipeline to get trending tags
		const trendingTags = await this.tagRepository.aggregate([
			{
				// tags modified within the time window
				$match: {
					modifiedAt: { $gte: timeThreshold },
					count: { $gt: 0 },
				},
			},
			{
				// project fields and calculate recency score
				$project: {
					tag: 1,
					count: 1,
					modifiedAt: 1,
					// calculate hours since last modification (for recency scoring)
					hoursSinceModified: {
						$divide: [{ $subtract: [new Date(), "$modifiedAt"] }, 3600000], // ms to hours
					},
				},
			},
			{
				// calculate trending score: recency + popularity
				// newer posts get higher score, but total count also matters
				$addFields: {
					trendingScore: {
						$add: [
							{ $multiply: ["$count", 2] }, // 2x for popularity
							{
								// recency bonus: inverse of hours (more recent = higher score)
								$divide: [timeWindowHours, { $add: ["$hoursSinceModified", 0.1] }],
							},
						],
					},
				},
			},
			{
				// sort by trending score descending
				$sort: { trendingScore: -1 },
			},
			{
				// limit to requested number
				$limit: limit,
			},
			{
				// final projection
				$project: {
					_id: 0,
					tag: 1,
					count: 1,
					recentPostCount: "$count",
				},
			},
		]);

		console.log(`[GetTrendingTagsQuery] Found ${trendingTags.length} trending tags`);
		if (trendingTags.length > 0) {
			console.log(`[GetTrendingTagsQuery] Top tag: ${trendingTags[0].tag} (count: ${trendingTags[0].count})`);
		}

		return trendingTags;
	}
}
