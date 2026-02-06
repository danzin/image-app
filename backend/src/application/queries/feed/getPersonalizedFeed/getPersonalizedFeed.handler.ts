import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetPersonalizedFeedQuery } from "./getPersonalizedFeed.query";
import { IPostReadRepository, IUserReadRepository } from "@/repositories/interfaces";
import { UserPreferenceRepository } from "@/repositories/userPreference.repository";
import { RedisService } from "@/services/redis.service";
import { EventBus } from "@/application/common/buses/event.bus";
import { ColdStartFeedGeneratedEvent } from "@/application/events/ColdStartFeedGenerated.event";
import { createError } from "@/utils/errors";
import { FollowRepository } from "@/repositories/follow.repository";
import { CoreFeed, FeedPost, PaginatedFeedResult } from "@/types";
import { logger } from "@/utils/winston";
import { FeedEnrichmentService } from "@/services/feed-enrichment.service";

@injectable()
export class GetPersonalizedFeedQueryHandler implements IQueryHandler<GetPersonalizedFeedQuery, any> {
	constructor(
		@inject("PostReadRepository") private postReadRepository: IPostReadRepository,
		@inject("UserReadRepository") private userReadRepository: IUserReadRepository,
		@inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("RedisService") private redisService: RedisService,
		@inject("EventBus") private eventBus: EventBus,
		@inject("FeedEnrichmentService") private feedEnrichmentService: FeedEnrichmentService,
	) {}

	async execute(query: GetPersonalizedFeedQuery): Promise<PaginatedFeedResult> {
		const { userId, page, limit } = query;
		logger.info(`Running partitioned getPersonalizedFeed for userId: ${userId}`);
		const safePage = Math.max(1, Math.floor(page || 1));
		const safeLimit = Math.min(100, Math.max(1, Math.floor(limit || 20)));

		try {
			// Get core feed structure (post IDs and order)
			const coreFeedKey = `core_feed:${userId}:${safePage}:${safeLimit}`;
			let coreFeed = (await this.redisService.getWithTags(coreFeedKey)) as CoreFeed | null;

			if (!coreFeed) {
				// cache miss - generate core feed
				logger.info("Core feed cache miss, generating...");
				coreFeed = await this.generateCoreFeed(userId, safePage, safeLimit);

				// store in redis with tags for smart invalidation
				const tags = [`user_feed:${userId}`, `feed_safePage:${safePage}`, `feed_safeLimit:${safeLimit}`];
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

	// the feed builder
	// new user - discovery/trending feed (getRankedFeed)
	// established user - posts from following + tag preferences (getFeedForUserCore)
	private async generateCoreFeed(userId: string, safePage: number, safeLimit: number): Promise<CoreFeed> {
		const user = await this.userReadRepository.findByPublicId(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const [topTags, followingIds] = await Promise.all([
			this.userPreferenceRepository.getTopUserTags(user.id),
			this.followRepository.getFollowingObjectIds(user.id),
		]);
		const favoriteTags = topTags.map((pref: any) => pref.tag);
		const skip = (safePage - 1) * safeLimit;

		// cold start scenario - user has no following and no tag preferences
		if (followingIds.length === 0 && favoriteTags.length === 0) {
			if (safePage === 1) {
				try {
					await this.eventBus.publish(new ColdStartFeedGeneratedEvent(userId));
				} catch {
					// non-fatal, ignore
				}
			}

			return this.postReadRepository.getRankedFeed(favoriteTags, safeLimit, skip);
		}

		return this.postReadRepository.getFeedForUserCore(followingIds, favoriteTags, safeLimit, skip);
	}
}
