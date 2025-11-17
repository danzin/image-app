import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetTrendingFeedQuery } from "./getTrendingFeed.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { RedisService } from "../../../../services/redis.service";
import { DTOService } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";
import { redisLogger } from "../../../../utils/winston";
import { FeedPost, PaginatedFeedResult, UserLookupData } from "types/index";

@injectable()
export class GetTrendingFeedQueryHandler implements IQueryHandler<GetTrendingFeedQuery, PaginatedFeedResult> {
	constructor(
		@inject("PostRepository") private postRepository: PostRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("RedisService") private redisService: RedisService,
		@inject("DTOService") private dtoService: DTOService
	) {}

	async execute(query: GetTrendingFeedQuery): Promise<PaginatedFeedResult> {
		const { page, limit } = query;
		redisLogger.info(`getTrendingFeed called`, { page, limit });

		try {
			// read post IDs from worker-computed sorted set (highest scores first)
			const start = (page - 1) * limit;
			const end = start + limit - 1;
			const postIds = await this.redisService.getTrendingRange(start, end);

			redisLogger.debug(`trending:posts zRange returned`, { postCount: postIds.length });

			let posts: any[];
			let total: number;

			if (postIds.length > 0) {
				redisLogger.info(`Trending feed ZSET HIT`, { postCount: postIds.length });

				// fetch post details individually
				const postPromises = postIds.map((id) => this.postRepository.findByPublicId(id));
				const postsResults = await Promise.all(postPromises);
				posts = postsResults.filter((p) => p !== null);

				// get total count from sorted set
				total = await this.redisService.getTrendingCount();
			} else {
				// fallback: worker hasn't populated sorted set yet, use MongoDB sort
				redisLogger.warn("trending:posts empty, falling back to MongoDB sort");
				const skip = (page - 1) * limit;
				const result = await this.postRepository.getTrendingFeed(limit, skip, {
					timeWindowDays: 14,
					minLikes: 1,
				});
				posts = result.data;
				total = result.total;
			}

			const transformedPosts = this.transformPosts(posts);
			const enriched = await this.enrichFeedWithCurrentData(transformedPosts);

			return {
				data: enriched,
				page,
				limit,
				total,
			};
		} catch (error) {
			redisLogger.error("Trending feed error", {
				error: error instanceof Error ? error.message : String(error),
			});
			throw createError("FeedError", "Could not generate trending feed.");
		}
	}

	private transformPosts(posts: any[]): FeedPost[] {
		return posts.map((post) => {
			const plainPost = typeof post.toObject === "function" ? post.toObject() : post;
			const userDoc = this.getUserSnapshot(plainPost);
			const imageDoc = plainPost.image as any;
			const tagsArray = Array.isArray(plainPost.tags) ? plainPost.tags : [];
			const normalizedTags = tagsArray
				.map((tag: any) => (tag && typeof tag === "object" ? { tag: tag.tag, publicId: tag.publicId } : null))
				.filter((tag: any): tag is { tag: string; publicId?: string } => Boolean(tag?.tag));

			return {
				publicId: plainPost.publicId,
				body: plainPost.body,
				slug: plainPost.slug,
				createdAt: plainPost.createdAt,
				likes: plainPost.likesCount ?? 0,
				commentsCount: plainPost.commentsCount ?? 0,
				viewsCount: plainPost.viewsCount ?? 0,
				userPublicId: userDoc?.publicId,
				tags: normalizedTags,
				user: {
					publicId: userDoc?.publicId,
					username: userDoc?.username,
					avatar: userDoc?.avatar ?? userDoc?.avatarUrl ?? "",
				},
				image: imageDoc ? { publicId: imageDoc.publicId, url: imageDoc.url, slug: imageDoc.slug } : undefined,
				rankScore: plainPost.rankScore,
				trendScore: plainPost.trendScore,
			};
		});
	}

	private getUserSnapshot(post: any) {
		const rawUser = post?.user;
		if (rawUser && typeof rawUser === "object" && (rawUser.publicId || rawUser.username)) {
			return rawUser;
		}
		return post?.author ?? {};
	}

	private async enrichFeedWithCurrentData(coreFeedData: any[]): Promise<FeedPost[]> {
		if (!coreFeedData || coreFeedData.length === 0) return [];

		// extract unique user publicIds from feed items
		const userPublicIds = [...new Set(coreFeedData.map((item) => item.userPublicId))];
		const postPublicIds = [...new Set(coreFeedData.map((item) => item.publicId).filter(Boolean))];

		// batch fetch user data with tag-based caching
		const userDataKey = `user_batch:${userPublicIds.sort().join(",")}`;
		let userData = await this.redisService.getWithTags(userDataKey);

		if (!userData) {
			userData = await this.userRepository.findUsersByPublicIds(userPublicIds);
			// cache with user-specific tags for avatar invalidation
			const userTags = userPublicIds.map((id) => `user_data:${id}`);
			await this.redisService.setWithTags(userDataKey, userData, userTags, 60);
		}

		const userMap = new Map<string, UserLookupData>(userData.map((user: UserLookupData) => [user.publicId, user]));

		// attempt to load per-post metadata with tag-based caching
		const postMetaKeys = postPublicIds.map((id) => `post_meta:${id}`);
		const metaResults = await Promise.all(postMetaKeys.map((k) => this.redisService.getWithTags(k).catch(() => null)));
		const metaMap = new Map<string, any>();
		postPublicIds.forEach((id, idx) => {
			if (metaResults[idx]) metaMap.set(id, metaResults[idx]);
		});

		// merge fresh user/image data into core feed
		return coreFeedData.map((item) => {
			const meta = metaMap.get(item.publicId);
			return {
				...item,
				likes: meta?.likes ?? item.likes,
				commentsCount: meta?.commentsCount ?? item.commentsCount,
				viewsCount: meta?.viewsCount ?? item.viewsCount,
				user: {
					publicId: userMap.get(item.userPublicId)?.publicId,
					username: userMap.get(item.userPublicId)?.username,
					avatar: userMap.get(item.userPublicId)?.avatar,
				},
			};
		});
	}
}
