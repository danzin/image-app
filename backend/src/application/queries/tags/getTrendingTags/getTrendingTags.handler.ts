import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetTrendingTagsQuery } from "./getTrendingTags.query";
import { inject, injectable } from "tsyringe";
import { RedisService } from "../../../../services/redis.service";
import { IPostReadRepository } from "../../../../repositories/interfaces";
import { createError } from "../../../../utils/errors";
import { GetTrendingTagsResult, TrendingTag } from "types/index";
import { logger } from "../../../../utils/winston";
import { CacheKeyBuilder } from "../../../../utils/cache/CacheKeyBuilder";

// activity tracking for dynamic TTL
interface ActivityMetrics {
	tagCreationCount: number;
	lastUpdated: number;
}

// TTL ranges based on activity
const TTL_CONFIG = {
	HIGH_ACTIVITY: 300, // 5 minutes when lots of new tags
	MEDIUM_ACTIVITY: 1800, // 30 minutes
	LOW_ACTIVITY: 86400, // 1 day
	VERY_LOW_ACTIVITY: 604800, // 1 week
	DORMANT: 2592000, // 30 days when site is basically inactive
};

// activity thresholds (tags per hour)
const ACTIVITY_THRESHOLDS = {
	HIGH: 10, // 10+ tags/hour = high activity
	MEDIUM: 2, // 2-10 tags/hour = medium
	LOW: 0.5, // 0.5-2 tags/hour = low
	VERY_LOW: 0.1, // 0.1-0.5 tags/hour = very low
	// below 0.1 = dormant
};

@injectable()
export class GetTrendingTagsQueryHandler implements IQueryHandler<GetTrendingTagsQuery, GetTrendingTagsResult> {
	private readonly CACHE_KEY_PREFIX = CacheKeyBuilder.getTrendingTagsPrefix();
	private readonly ACTIVITY_KEY = "trending_tags:activity_metrics";
	private readonly HISTORICAL_KEY = "trending_tags:historical";
	private readonly HISTORICAL_TTL = 3888000; // 45 days

	constructor(
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("RedisService") private readonly redisService: RedisService,
	) {}

	async execute(query: GetTrendingTagsQuery): Promise<GetTrendingTagsResult> {
		try {
			const limit = Math.min(Math.max(query.limit ?? 5, 1), 20);
			const timeWindowHours = Math.max(1, query.timeWindowHours ?? 168);
			const cacheKey = CacheKeyBuilder.getTrendingTagsKey(limit, timeWindowHours);

			// try to get from cache first
			const cached = await this.redisService.get<GetTrendingTagsResult>(cacheKey);
			if (cached) {
				logger.info("[GetTrendingTagsQuery] Returning cached trending tags");
				return cached;
			}

			// compute trending tags
			let tags = await this.computeTrendingTags(limit, timeWindowHours);

			// if no tags found, try with progressively wider time windows
			if (tags.length === 0) {
				const extendedWindows = [336, 720, 2160, 4320]; // 2 weeks, 1 month, 3 months, 6 months
				for (const window of extendedWindows) {
					tags = await this.computeTrendingTags(limit, window);
					if (tags.length > 0) {
						logger.info(`[GetTrendingTagsQuery] Found tags with extended window: ${window}h`);
						break;
					}
				}
			}

			// if still no tags, fall back to historical cache
			if (tags.length === 0) {
				const historical = await this.redisService.get<GetTrendingTagsResult>(this.HISTORICAL_KEY);
				if (historical && historical.tags.length > 0) {
					logger.info("[GetTrendingTagsQuery] Using historical trending tags fallback");
					return historical;
				}
			}

			const result: GetTrendingTagsResult = { tags };

			// calculate dynamic TTL based on activity
			const ttl = await this.calculateDynamicTTL();

			// cache with dynamic TTL
			await this.redisService.set(cacheKey, result, ttl);

			// update historical cache if we have good data
			if (tags.length > 0) {
				await this.redisService.set(this.HISTORICAL_KEY, result, this.HISTORICAL_TTL);
			}

			// update activity metrics
			await this.updateActivityMetrics(tags.length);

			logger.info(`[GetTrendingTagsQuery] Cached ${tags.length} trending tags with TTL: ${ttl}s`);
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
	 * Calculate dynamic TTL based on site activity level
	 * Low activity = long TTL (keep tags visible longer)
	 * High activity = short TTL (refresh more frequently)
	 */
	private async calculateDynamicTTL(): Promise<number> {
		try {
			const metrics = await this.redisService.get<ActivityMetrics>(this.ACTIVITY_KEY);

			if (!metrics) {
				// no metrics yet, use medium TTL
				return TTL_CONFIG.MEDIUM_ACTIVITY;
			}

			const hoursSinceLastUpdate = (Date.now() - metrics.lastUpdated) / 3600000;
			const tagsPerHour = hoursSinceLastUpdate > 0 ? metrics.tagCreationCount / hoursSinceLastUpdate : 0;

			// determine TTL based on activity rate
			if (tagsPerHour >= ACTIVITY_THRESHOLDS.HIGH) {
				return TTL_CONFIG.HIGH_ACTIVITY;
			} else if (tagsPerHour >= ACTIVITY_THRESHOLDS.MEDIUM) {
				return TTL_CONFIG.MEDIUM_ACTIVITY;
			} else if (tagsPerHour >= ACTIVITY_THRESHOLDS.LOW) {
				return TTL_CONFIG.LOW_ACTIVITY;
			} else if (tagsPerHour >= ACTIVITY_THRESHOLDS.VERY_LOW) {
				return TTL_CONFIG.VERY_LOW_ACTIVITY;
			} else {
				// site is dormant, keep tags for a month
				return TTL_CONFIG.DORMANT;
			}
		} catch (error) {
			logger.warn("[GetTrendingTagsQuery] Error calculating dynamic TTL, using default", error);
			return TTL_CONFIG.MEDIUM_ACTIVITY;
		}
	}

	/**
	 * Update activity metrics for TTL calculation
	 */
	private async updateActivityMetrics(tagCount: number): Promise<void> {
		try {
			const existing = await this.redisService.get<ActivityMetrics>(this.ACTIVITY_KEY);
			const now = Date.now();

			if (existing) {
				const hoursSinceLastUpdate = (now - existing.lastUpdated) / 3600000;
				// decay old counts over time (exponential decay)
				const decayFactor = Math.exp(-hoursSinceLastUpdate / 24); // half-life of ~24 hours
				const decayedCount = existing.tagCreationCount * decayFactor;

				await this.redisService.set(
					this.ACTIVITY_KEY,
					{
						tagCreationCount: decayedCount + tagCount,
						lastUpdated: now,
					},
					604800, // keep metrics for 1 week
				);
			} else {
				await this.redisService.set(
					this.ACTIVITY_KEY,
					{
						tagCreationCount: tagCount,
						lastUpdated: now,
					},
					604800,
				);
			}
		} catch (error) {
			logger.warn("[GetTrendingTagsQuery] Error updating activity metrics", error);
		}
	}

	/**
	 * Invalidate the trending tags cache when new posts with tags are created
	 */
	async invalidateCache(): Promise<void> {
		try {
			const deleted = await this.redisService.del(`${this.CACHE_KEY_PREFIX}:*`);
			logger.info(`[GetTrendingTagsQuery] Cache invalidated (keys deleted: ${deleted})`);
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
		const trendingTags = await this.postReadRepository.getTrendingTags(limit, timeWindowHours);

		logger.info(`[GetTrendingTagsQuery] Found ${trendingTags.length} trending tags`);
		if (trendingTags.length > 0) {
			logger.info(`[GetTrendingTagsQuery] Top tag: ${trendingTags[0].tag} (count: ${trendingTags[0].count})`);
		}

		return trendingTags;
	}
}
