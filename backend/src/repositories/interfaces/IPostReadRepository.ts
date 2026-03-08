import { ClientSession } from "mongoose";
import {
  CursorPaginationOptions,
  CursorPaginationResult,
  FeedPost,
  IPost,
  PaginationOptions,
  PaginationResult,
  TrendingTag,
} from "@/types";

/**
 * Read-only repository interface for post queries
 * used by query handlers in CQRS pattern
 */
export interface IPostReadRepository {
  // single post lookups
  findById(id: string, session?: ClientSession): Promise<IPost | null>;
  findInternalIdByPublicId(publicId: string): Promise<string | null>;
  findOneByPublicId(publicId: string, session?: ClientSession): Promise<IPost | null>;
  findByIdWithPopulates(id: string, session?: ClientSession): Promise<IPost | null>;
  findByPublicId(publicId: string, session?: ClientSession): Promise<IPost | null>;
  findBySlug(slug: string, session?: ClientSession): Promise<IPost | null>;
  getNewFeedWithCursor(options: CursorPaginationOptions): Promise<CursorPaginationResult<FeedPost>>;
  getTrendingFeedWithCursor(
    options: CursorPaginationOptions & {
      timeWindowDays?: number;
      minLikes?: number;
      weights?: { recency?: number; popularity?: number; comments?: number };
    }
  ): Promise<CursorPaginationResult<FeedPost>>;
  getRankedFeedWithCursor(
    favoriteTags: string[],
    options: CursorPaginationOptions & {
      weights?: { recency?: number; popularity?: number; tagMatch?: number };
    }
  ): Promise<CursorPaginationResult<FeedPost>>;
  // batch lookups
  findPostsByIds(ids: string[], viewerPublicId?: string): Promise<FeedPost[]>;
  findPostsByPublicIds(publicIds: string[]): Promise<FeedPost[]>;
  findByUserPublicId(userPublicId: string, options: PaginationOptions): Promise<PaginationResult<FeedPost>>;
  findByCommunityId(communityId: string, page: number, limit: number): Promise<IPost[]>;
  findByTags(
    tagIds: string[],
    options?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string },
  ): Promise<PaginationResult<IPost>>;

  // paginated queries
  findWithPagination(options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<FeedPost>>;

  // feed queries
  getFeedForUserCoreWithCursor(
    followingIds: string[],
    favoriteTags: string[],
    options: CursorPaginationOptions
  ): Promise<CursorPaginationResult<FeedPost>>;
  getRankedFeed(followingIds: string[], limit: number, skip: number): Promise<PaginationResult<FeedPost>>;
  getTrendingFeed(
    limit: number,
    skip: number,
    options?: {
      timeWindowDays?: number;
      minLikes?: number;
      weights?: { recency?: number; popularity?: number; comments?: number };
    },
  ): Promise<PaginationResult<FeedPost>>;
  getTrendingFeedWithFacet(
    limit: number,
    skip: number,
    options?: {
      timeWindowDays?: number;
      minLikes?: number;
      weights?: { recency?: number; popularity?: number; comments?: number };
    }
  ): Promise<PaginationResult<FeedPost>>;
  getNewFeed(limit: number, skip: number): Promise<PaginationResult<FeedPost>>;

  // single post by arbitrary filter
  findOneByFilter(filter: Record<string, unknown>): Promise<IPost | null>;

  // counts
  countDocuments(filter: Record<string, unknown>): Promise<number>;
  countByCommunityId(communityId: string): Promise<number>;

  // tag analytics
  getTrendingTags(limit: number, timeWindowHours: number): Promise<TrendingTag[]>;
}
