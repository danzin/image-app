import { inject, injectable } from "tsyringe";
import { PostRepository } from "@/repositories/post.repository";
import { RedisService } from "../redis.service";
import { DTOService } from "../dto.service";
import { FeedEnrichmentService } from "../feed-enrichment.service";
import { FeedCoreService } from "../feed-core.service";
import { createError } from "@/utils/errors";
import { logger } from "@/utils/winston";
import { CacheConfig } from "@/config/cacheConfig";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";
import { CoreFeed, FeedPost, PaginationResult, PostDTO } from "@/types";

@injectable()
export class FeedReadService {
	constructor(
		@inject("PostRepository") private postRepository: PostRepository,
		@inject("RedisService") private redisService: RedisService,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("FeedEnrichmentService") private readonly feedEnrichmentService: FeedEnrichmentService,
		@inject("FeedCoreService") private readonly feedCoreService: FeedCoreService,
	) {}

	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		logger.info(`Running partitioned getPersonalizedFeed for userId: ${userId}`);
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

		try {
			const coreFeedKey = CacheKeyBuilder.getCoreFeedKey(userId, safePage, safeLimit);
			let coreFeed = await this.redisService.getWithTags<CoreFeed>(coreFeedKey);
			const isCacheHit = !!coreFeed;

			if (!coreFeed) {
				logger.info("Core feed cache miss, generating...");
				coreFeed = await this.feedCoreService.generatePersonalizedCoreFeed(userId, safePage, safeLimit);

				const tags = [
					CacheKeyBuilder.getUserFeedTag(userId),
					CacheKeyBuilder.getFeedPageTag(safePage),
					CacheKeyBuilder.getFeedLimitTag(safeLimit),
				];
				await this.redisService.setWithTags(coreFeedKey, coreFeed, tags, 300);
			} else {
				logger.info("Core feed cache hit");
			}

			const enrichedFeed = await this.feedEnrichmentService.enrichFeedWithCurrentData(coreFeed.data, {
				refreshUserData: isCacheHit,
			});

			return {
				...coreFeed,
				data: this.mapToPostDTOArray(enrichedFeed),
				total: coreFeed.total ?? 0,
				page: coreFeed.page ?? safePage,
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

	public async getTrendingFeed(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
		const cacheKey = CacheKeyBuilder.getTrendingFeedKey(safePage, safeLimit);

		let cached = await this.redisService.getWithTags<CoreFeed>(cacheKey);
		const isCacheHit = !!cached;
		if (!cached) {
			const skip = (safePage - 1) * safeLimit;
			const core = await this.postRepository.getTrendingFeed(safeLimit, skip, { timeWindowDays: 14, minLikes: 1 });
			await this.redisService.setWithTags(
				cacheKey,
				core,
				[
					CacheKeyBuilder.getTrendingFeedTag(),
					CacheKeyBuilder.getFeedPageTag(safePage),
					CacheKeyBuilder.getFeedLimitTag(safeLimit),
				],
				CacheConfig.FEED.TRENDING_FEED,
			);
			cached = core as CoreFeed;
		}

		const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(cached.data, {
			refreshUserData: isCacheHit,
		});

		return {
			...cached,
			data: this.mapToPostDTOArray(enriched),
			total: cached.total ?? 0,
			page: cached.page ?? safePage,
			totalPages: cached.totalPages ?? 0,
		};
	}

	public async getNewFeed(
		page: number,
		limit: number,
		forceRefresh = false,
		cursor?: string,
	): Promise<PaginationResult<PostDTO> & { nextCursor?: string }> {
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));
		const key = cursor
			? CacheKeyBuilder.getNewFeedCursorKey(cursor, safeLimit)
			: CacheKeyBuilder.getNewFeedKey(safePage, safeLimit);

		let cached: CoreFeed | null = null;
		if (!forceRefresh) {
			cached = await this.redisService.getWithTags<CoreFeed>(key);
		}

		const isCacheHit = !!cached;
		if (!cached) {
			let core: CoreFeed;
			const useCursorFlow = Boolean(cursor) || safePage === 1;

			if (useCursorFlow) {
				const coreCursor = await this.postRepository.getNewFeedWithCursor({ limit: safeLimit, cursor });
				core = {
					data: coreCursor.data as FeedPost[],
					limit: safeLimit,
					hasMore: coreCursor.hasMore,
					nextCursor: coreCursor.nextCursor,
					prevCursor: coreCursor.prevCursor,
					total: 0,
					page: safePage,
					totalPages: 0,
				};
			} else {
				const skip = (safePage - 1) * safeLimit;
				const corePage = await this.postRepository.getNewFeed(safeLimit, skip);
				core = {
					data: corePage.data as FeedPost[],
					limit: corePage.limit ?? safeLimit,
					total: corePage.total ?? 0,
					page: corePage.page ?? safePage,
					totalPages: corePage.totalPages ?? 0,
				};
			}

			await this.redisService.setWithTags(
				key,
				core,
				[
					CacheKeyBuilder.getNewFeedTag(),
					...(cursor ? [] : [CacheKeyBuilder.getFeedPageTag(safePage), CacheKeyBuilder.getFeedLimitTag(safeLimit)]),
				],
				CacheConfig.FEED.NEW_FEED,
			);
			cached = core;
		}

		const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(cached.data, {
			refreshUserData: isCacheHit,
		});

		return {
			...cached,
			data: this.mapToPostDTOArray(enriched),
			total: cached.total ?? 0,
			page: cached.page ?? safePage,
			totalPages: cached.totalPages ?? 0,
		};
	}

	private mapToPostDTOArray(entries: FeedPost[]): PostDTO[] {
		return entries.map((entry) => this.dtoService.toPostDTO(this.ensurePlain(entry)));
	}

	private ensurePlain(entry: any): FeedPost {
		if (entry && typeof entry.toObject === "function") {
			return entry.toObject() as FeedPost;
		}
		return entry as FeedPost;
	}
}
