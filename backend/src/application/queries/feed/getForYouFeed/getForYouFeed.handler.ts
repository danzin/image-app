import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetForYouFeedQuery } from "./getForYouFeed.query";
import { IPostReadRepository, IUserReadRepository } from "@/repositories/interfaces";
import { UserPreferenceRepository } from "@/repositories/userPreference.repository";
import { RedisService } from "@/services/redis.service";
import { EventBus } from "@/application/common/buses/event.bus";
import { createError } from "@/utils/errors";
import { errorLogger, redisLogger } from "@/utils/winston";
import { FeedEnrichmentService } from "@/services/feed-enrichment.service";
import { FeedPost, PaginatedFeedResult, UserLookupData, IPost } from "@/types";

@injectable()
export class GetForYouFeedQueryHandler implements IQueryHandler<GetForYouFeedQuery, PaginatedFeedResult> {
	constructor(
		@inject("PostReadRepository") private postReadRepository: IPostReadRepository,
		@inject("UserReadRepository") private userReadRepository: IUserReadRepository,
		@inject("UserPreferenceRepository") private userPreferenceRepository: UserPreferenceRepository,
		@inject("RedisService") private redisService: RedisService,
		@inject("EventBus") private eventBus: EventBus,
		@inject("FeedEnrichmentService") private feedEnrichmentService: FeedEnrichmentService,
	) {}

	async execute(query: GetForYouFeedQuery): Promise<PaginatedFeedResult> {
		const { userId, page, limit } = query;
		redisLogger.info(`getForYouFeed called`, { userId, page, limit });

		try {
			// try to get from sorted set first
			const postIds = await this.redisService.getFeedPage(userId, page, limit, "for_you");
			redisLogger.debug(`getFeedPage returned`, { userId, postCount: postIds.length });

			if (postIds.length > 0) {
				redisLogger.info(`For You feed ZSET HIT`, { userId, postCount: postIds.length });
				// fetch post details individually (TODO: add batch fetch to PostRepository)
				const postPromises = postIds.map((id) => this.postReadRepository.findByPublicId(id));
				const postsResults = await Promise.all(postPromises);
				const posts = postsResults.filter((p) => p !== null);
				const transformedPosts = this.transformPosts(posts);

				const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(transformedPosts);
				const feedSize = await this.redisService.getFeedSize(userId, "for_you");

				return {
					data: enriched,
					page,
					limit,
					total: feedSize,
					totalPages: Math.ceil(feedSize / limit),
				};
			}

			// cache miss - generate feed and populate sorted set
			redisLogger.info(`For You feed ZSET MISS, generating from DB`, { userId });
			const feed = await this.generateForYouFeed(userId, page, limit);
			const transformedFeedData = this.transformPosts(feed.data);

			// populate sorted set with all posts (fire-and-forget for page 1)
			if (page === 1 && transformedFeedData.length > 0) {
				const timestamp = Date.now();
				redisLogger.info(`Populating ZSET for user`, { userId, postCount: transformedFeedData.length });
				Promise.all(
					transformedFeedData.map((post: FeedPost, idx: number) => {
						return this.redisService.addToFeed(userId, post.publicId, timestamp - idx, "for_you");
					}),
				).catch((err) => {
					errorLogger.error(`Failed to populate For You feed ZSET`, { userId, error: err.message });
				});
			}

			const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(transformedFeedData);
			return {
				...feed,
				data: enriched,
			};
		} catch (error) {
			errorLogger.error("For You feed error", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw createError("FeedError", "Could not generate For You feed.");
		}
	}

	private transformPosts(posts: (IPost | Record<string, unknown>)[]): FeedPost[] {
		return posts.map((post) => {
			const plainPost = post as any;
			const userDoc = this.getUserSnapshot(plainPost);
			const imageDoc = plainPost.image;
			const tagsArray = (Array.isArray(plainPost.tags) ? plainPost.tags : []) as any[];

			const normalizedTags = tagsArray.reduce<{ tag: string; publicId?: string }[]>((acc, tag) => {
				if (tag && typeof tag === "object") {
					acc.push({
						tag: tag.tag,
						publicId: tag.publicId,
					});
				}
				return acc;
			}, []);

			return {
				publicId: plainPost.publicId,
				body: plainPost.body ?? "",
				slug: plainPost.slug ?? "",
				createdAt: plainPost.createdAt,
				likes: plainPost.likesCount ?? plainPost.likes ?? 0,
				commentsCount: plainPost.commentsCount ?? 0,
				viewsCount: plainPost.viewsCount ?? 0,
				userPublicId: userDoc?.publicId as string,
				tags: normalizedTags,
				user: {
					publicId: userDoc?.publicId as string,
					username: userDoc?.username as string,
					avatar: userDoc?.avatar ?? "",
				},
				image: imageDoc
					? {
							publicId: imageDoc.publicId,
							url: imageDoc.url,
							slug: imageDoc.slug,
						}
					: undefined,
				rankScore: plainPost.rankScore,
				trendScore: plainPost.trendScore,
			};
		});
	}

	private getUserSnapshot(post: IPost): Partial<UserLookupData> {
		const user = post.user;
		// Check if user is an object and has publicId/username (not an ObjectId)
		if (user && typeof user === "object" && ("publicId" in user || "username" in user)) {
			return user as Partial<UserLookupData>;
		}
		// Fallback to author (common in Mongoose IPost)
		const author = post.author;
		if (author && typeof author === "object") {
			return author as Partial<UserLookupData>;
		}
		return {};
	}

	private async generateForYouFeed(userId: string, page: number, limit: number) {
		const user = await this.userReadRepository.findByPublicId(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		const topTags = await this.userPreferenceRepository.getTopUserTags(String(user._id));
		const favoriteTags = topTags.map((pref) => pref.tag);
		const skip = (page - 1) * limit;
		return this.postReadRepository.getRankedFeed(favoriteTags, limit, skip);
	}
}
