import { ClientSession } from "mongoose";
import { IPost, PaginationOptions, PaginationResult, TrendingTag } from "@/types";

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

	// batch lookups
	findPostsByIds(ids: string[], viewerPublicId?: string): Promise<IPost[]>;
	findPostsByPublicIds(publicIds: string[]): Promise<IPost[]>;
	findByUserPublicId(userPublicId: string, options: PaginationOptions): Promise<PaginationResult<IPost>>;
	findByCommunityId(communityId: string, page: number, limit: number): Promise<IPost[]>;
	findByTags(
		tagIds: string[],
		options?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string },
	): Promise<PaginationResult<IPost>>;

	// paginated queries
	findWithPagination(options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IPost>>;

	// feed queries
	getFeedForUserCore(
		followingIds: string[],
		favoriteTags: string[],
		limit: number,
		skip: number,
	): Promise<PaginationResult<any>>;
	getRankedFeed(favoriteTags: string[], limit: number, skip: number): Promise<PaginationResult<any>>;
	getTrendingFeed(
		limit: number,
		skip: number,
		options?: {
			timeWindowDays?: number;
			minLikes?: number;
			weights?: { recency?: number; popularity?: number; comments?: number };
		},
	): Promise<PaginationResult<any>>;
	getNewFeed(limit: number, skip: number): Promise<PaginationResult<any>>;

	// counts
	countDocuments(filter: Record<string, unknown>): Promise<number>;
	countByCommunityId(communityId: string): Promise<number>;

	// tag analytics
	getTrendingTags(limit: number, timeWindowHours: number): Promise<TrendingTag[]>;
}
