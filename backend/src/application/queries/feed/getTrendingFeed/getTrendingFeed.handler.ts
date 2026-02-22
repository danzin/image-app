import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetTrendingFeedQuery } from "./getTrendingFeed.query";
import { IPostReadRepository, IUserReadRepository } from "@/repositories/interfaces";
import { RedisService } from "@/services/redis.service";
import { DTOService } from "@/services/dto.service";
import { createError } from "@/utils/errors";
import { redisLogger } from "@/utils/winston";
import { FeedPost, PaginatedFeedResult, IPost, IImage, ITag, UserLookupData, PostMeta } from "@/types";
import { FeedEnrichmentService } from "@/services/feed-enrichment.service";

@injectable()
export class GetTrendingFeedQueryHandler implements IQueryHandler<GetTrendingFeedQuery, PaginatedFeedResult> {
  constructor(
    @inject("PostReadRepository") private postReadRepository: IPostReadRepository,
    @inject("UserReadRepository") private userReadRepository: IUserReadRepository,
    @inject("RedisService") private redisService: RedisService,
    @inject("DTOService") private dtoService: DTOService,
    @inject("FeedEnrichmentService") private feedEnrichmentService: FeedEnrichmentService,
  ) { }

  async execute(query: GetTrendingFeedQuery): Promise<PaginatedFeedResult> {
    const { page, limit, cursor } = query;
    redisLogger.info(`getTrendingFeed called`, { page, limit, hasCursor: !!cursor });

    try {
      // Always try cursor-based pagination (Redis or DB)
      // If cursor is undefined, it fetches the first page
      redisLogger.debug("Using cursor-based trending feed strategy");

      let isNewPhase = false;
      let actualCursor = cursor;
      if (cursor?.startsWith("new_phase:")) {
        isNewPhase = true;
        actualCursor = cursor.replace("new_phase:", "");
      }

      if (isNewPhase) {
        const result = await this.postReadRepository.getNewFeedWithCursor({ limit, cursor: actualCursor });
        const transformedPosts = this.transformPosts(result.data);
        const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(transformedPosts);

        return {
          data: enriched,
          page: page,
          limit,
          total: 0,
          totalPages: 0,
          nextCursor: result.nextCursor ? `new_phase:${result.nextCursor}` : undefined,
          hasMore: result.hasMore
        } as any;
      }


      // Try Redis ZSET first
      try {
        const redisResult = await this.redisService.getTrendingFeedWithCursor(limit, cursor);
        if (redisResult.ids.length > 0) {
          redisLogger.info(`Trending feed ZSET HIT`, { count: redisResult.ids.length });
          const posts = await this.postReadRepository.findPostsByPublicIds(redisResult.ids);

          // Re-sort to match Redis order
          const postMap = new Map(posts.map(p => [p.publicId, p]));
          const orderedPosts = redisResult.ids.map(id => postMap.get(id)).filter(Boolean) as any[];

          const transformedPosts = this.transformPosts(orderedPosts);
          const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(transformedPosts);

          return {
            data: enriched,
            page: page, // keep page for backward compat in response structure
            limit,
            total: 0,
            totalPages: 0,
            nextCursor: redisResult.nextCursor,
            hasMore: redisResult.hasMore
          } as any;
        }
      } catch (err) {
        redisLogger.warn("Failed to get trending feed from Redis, falling back to DB", { error: err });
      }

      // Fallback to DB cursor pagination
      redisLogger.info("Falling back to DB cursor pagination for trending feed");
      let result = await this.postReadRepository.getTrendingFeedWithCursor({
        limit,
        cursor: actualCursor,
        timeWindowDays: 30,
        minLikes: 1,
      });

      let transformedPosts = this.transformPosts(result.data);
      let nextCursor = result.nextCursor;
      let hasMore = result.hasMore;

      // Backfill transitioning from trending to new phase
      if (!hasMore || transformedPosts.length <= limit) {
        const needed = limit - transformedPosts.length + 1;
        if (needed > 0) {
          // We need to fetch from new feed to fill the page, or just start fetching so we can generate a new_phase cursor.
          const backfill = await this.postReadRepository.getNewFeedWithCursor({ limit: needed });
          const existingIds = new Set(transformedPosts.map(p => p.publicId));

          const uniqueBackfill = backfill.data.filter(p => !existingIds.has(p.publicId));
          const mappedBackfill = this.transformPosts(uniqueBackfill);

          transformedPosts = [...transformedPosts, ...mappedBackfill];
          nextCursor = backfill.nextCursor ? `new_phase:${backfill.nextCursor}` : undefined;
          hasMore = backfill.hasMore;
        }
      }

      // Ensure we respect the limit
      if (transformedPosts.length > limit) {
        transformedPosts = transformedPosts.slice(0, limit);
        hasMore = true;
      }

      const enriched = await this.feedEnrichmentService.enrichFeedWithCurrentData(transformedPosts);

      return {
        data: enriched,
        page: page,
        limit,
        total: 0,
        totalPages: 0,
        nextCursor,
        hasMore
      } as any;

    } catch (error) {
      redisLogger.error("Trending feed error", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw createError("FeedError", "Could not generate trending feed.");
    }
  }

  private transformPosts(posts: (IPost | Record<string, unknown>)[]): FeedPost[] {
    return posts.map((post) => {
      const plainPost =
        typeof (post as any).toObject === "function" ? (post as IPost).toObject() : (post as Record<string, unknown>);
      const userDoc = this.getUserSnapshot(plainPost);
      const imageDoc = plainPost.image as IImage | Record<string, unknown> | undefined;
      const repostOfDoc = plainPost.repostOf as IPost | Record<string, unknown> | undefined;
      const tagsArray = (Array.isArray(plainPost.tags) ? plainPost.tags : []) as unknown[];
      const normalizedTags = tagsArray.reduce<{ tag: string; publicId?: string }[]>((acc, tag) => {
        if (tag && typeof tag === "object") {
          if ("tag" in tag) {
            acc.push({
              tag: (tag as { tag: string }).tag,
              publicId: (tag as { publicId?: string }).publicId,
            });
          } else {
            acc.push({ tag: (tag as ITag).tag });
          }
        }
        return acc;
      }, []);

      return {
        publicId: plainPost.publicId as string,
        body: (plainPost.body as string) ?? "",
        slug: (plainPost.slug as string) ?? "",
        createdAt: plainPost.createdAt as Date,
        likes: (plainPost.likesCount as number) ?? 0,
        commentsCount: (plainPost.commentsCount as number) ?? 0,
        viewsCount: (plainPost.viewsCount as number) ?? 0,
        userPublicId: userDoc?.publicId as string,
        tags: normalizedTags,
        user: {
          publicId: userDoc?.publicId as string,
          handle: userDoc?.handle ?? "",
          username: userDoc?.username as string,
          avatar: userDoc?.avatar ?? userDoc?.avatarUrl ?? "",
        },
        image: imageDoc
          ? {
            publicId: (imageDoc as any).publicId,
            url: (imageDoc as any).url,
            slug: (imageDoc as any).slug,
          }
          : undefined,
        repostOf: repostOfDoc ? this.transformRepostOf(repostOfDoc) : undefined,
        rankScore: plainPost.rankScore as number | undefined,
        trendScore: plainPost.trendScore as number | undefined,
      };
    });
  }

  private transformRepostOf(repostOf: IPost | Record<string, unknown>): Partial<FeedPost> | undefined {
    if (!repostOf) return undefined;

    const originalUserDoc = this.getUserSnapshot(repostOf);
    const originalImageDoc = repostOf.image as IImage | Record<string, unknown> | undefined;
    const originalTagsArray = (Array.isArray(repostOf.tags) ? repostOf.tags : []) as unknown[];
    const normalizedOriginalTags = originalTagsArray.reduce<{ tag: string; publicId?: string }[]>(
      (acc, tag: unknown) => {
        if (tag && typeof tag === "object") {
          if ("tag" in tag) {
            acc.push({
              tag: (tag as { tag: string }).tag,
              publicId: (tag as { publicId?: string }).publicId,
            });
          } else {
            acc.push({ tag: (tag as ITag).tag });
          }
        }
        return acc;
      },
      [],
    );

    return {
      publicId: repostOf.publicId as string,
      body: (repostOf.body as string) ?? "",
      slug: (repostOf.slug as string) ?? "",
      createdAt: repostOf.createdAt as Date,
      likes: (repostOf.likesCount as number) ?? 0,
      commentsCount: (repostOf.commentsCount as number) ?? 0,
      tags: normalizedOriginalTags,
      user: {
        publicId: originalUserDoc?.publicId as string,
        handle: originalUserDoc?.handle ?? "",
        username: originalUserDoc?.username as string,
        avatar: originalUserDoc?.avatar ?? originalUserDoc?.avatarUrl ?? "",
      },
      image: originalImageDoc
        ? ({ publicId: originalImageDoc.publicId, url: originalImageDoc.url, slug: originalImageDoc.slug } as IImage)
        : undefined,
    };
  }

  private getUserSnapshot(post: IPost | Record<string, unknown>): {
    publicId?: string;
    handle?: string;
    username?: string;
    avatar?: string;
    avatarUrl?: string;
  } {
    const rawUser = "user" in post ? (post as Record<string, unknown>).user : undefined;
    if (rawUser && typeof rawUser === "object" && ("publicId" in rawUser || "username" in rawUser)) {
      return rawUser as {
        publicId?: string;
        handle?: string;
        username?: string;
        avatar?: string;
        avatarUrl?: string;
      };
    }
    const author = "author" in post ? (post as Record<string, unknown>).author : undefined;
    return (author as any) ?? {};
  }
}
