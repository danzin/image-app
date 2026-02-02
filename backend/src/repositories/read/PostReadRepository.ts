import { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import {
	CursorPaginationOptions,
	CursorPaginationResult,
	IPost,
	PaginationOptions,
	PaginationResult,
	TrendingTag,
} from "@/types";
import { IPostReadRepository } from "../interfaces/IPostReadRepository";
import { PostRepository } from "../post.repository";

/**
 * Read-only repository for post queries
 * delegates to the existing PostRepository for now
 * can be pointed to a read replica connection in the future
 */
@injectable()
export class PostReadRepository implements IPostReadRepository {
	constructor(@inject("PostRepository") private readonly postRepository: PostRepository) {}

	async findById(id: string, session?: ClientSession): Promise<IPost | null> {
		return this.postRepository.findById(id, session);
	}

	async findInternalIdByPublicId(publicId: string): Promise<string | null> {
		return this.postRepository.findInternalIdByPublicId(publicId);
	}

	async findOneByPublicId(publicId: string, session?: ClientSession): Promise<IPost | null> {
		return this.postRepository.findOneByPublicId(publicId, session);
	}

	async findByIdWithPopulates(id: string, session?: ClientSession): Promise<IPost | null> {
		return this.postRepository.findByIdWithPopulates(id, session);
	}

	async findByPublicId(publicId: string, session?: ClientSession): Promise<IPost | null> {
		return this.postRepository.findByPublicId(publicId, session);
	}

	async findBySlug(slug: string, session?: ClientSession): Promise<IPost | null> {
		return this.postRepository.findBySlug(slug, session);
	}

	async findPostsByIds(ids: string[], viewerPublicId?: string): Promise<IPost[]> {
		return this.postRepository.findPostsByIds(ids, viewerPublicId);
	}

	async findPostsByPublicIds(publicIds: string[]): Promise<IPost[]> {
		return this.postRepository.findPostsByPublicIds(publicIds);
	}

	async findByUserPublicId(userPublicId: string, options: PaginationOptions): Promise<PaginationResult<IPost>> {
		return this.postRepository.findByUserPublicId(userPublicId, options);
	}

	async findByCommunityId(communityId: string, page: number, limit: number): Promise<IPost[]> {
		return this.postRepository.findByCommunityId(communityId, page, limit);
	}

	async findByTags(
		tagIds: string[],
		options?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string },
	): Promise<PaginationResult<IPost>> {
		return this.postRepository.findByTags(tagIds, options);
	}

	async findWithPagination(options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IPost>> {
		return this.postRepository.findWithPagination(options, session);
	}

	async getFeedForUserCore(
		followingIds: string[],
		favoriteTags: string[],
		limit: number,
		skip: number,
	): Promise<PaginationResult<any>> {
		return this.postRepository.getFeedForUserCore(followingIds, favoriteTags, limit, skip);
	}

	async getRankedFeed(favoriteTags: string[], limit: number, skip: number): Promise<PaginationResult<any>> {
		return this.postRepository.getRankedFeed(favoriteTags, limit, skip);
	}

	async getTrendingFeed(
		limit: number,
		skip: number,
		options?: {
			timeWindowDays?: number;
			minLikes?: number;
			weights?: { recency?: number; popularity?: number; comments?: number };
		},
	): Promise<PaginationResult<any>> {
		return this.postRepository.getTrendingFeed(limit, skip, options);
	}

	async getTrendingFeedWithFacet(
		limit: number,
		skip: number,
		options?: {
			timeWindowDays?: number;
			minLikes?: number;
			weights?: { recency?: number; popularity?: number; comments?: number };
		}
	): Promise<PaginationResult<any>> {
		return this.postRepository.getTrendingFeedWithFacet(limit, skip, options);
	}

	async getNewFeedWithCursor(options: CursorPaginationOptions): Promise<CursorPaginationResult<IPost>> {
		return this.postRepository.getNewFeedWithCursor(options);
	}

	async getTrendingFeedWithCursor(
		options: CursorPaginationOptions & {
			timeWindowDays?: number;
			minLikes?: number;
			weights?: { recency?: number; popularity?: number; comments?: number };
		}
	): Promise<CursorPaginationResult<IPost>> {
		return this.postRepository.getTrendingFeedWithCursor(options);
	}

	async getRankedFeedWithCursor(
		favoriteTags: string[],
		options: CursorPaginationOptions & {
			weights?: { recency?: number; popularity?: number; tagMatch?: number };
		}
	): Promise<CursorPaginationResult<IPost>> {
		return this.postRepository.getRankedFeedWithCursor(favoriteTags, options);
	}

	async getNewFeed(limit: number, skip: number): Promise<PaginationResult<any>> {
		return this.postRepository.getNewFeed(limit, skip);
	}

	async countDocuments(filter: Record<string, unknown>): Promise<number> {
		return this.postRepository.countDocuments(filter);
	}

	async countByCommunityId(communityId: string): Promise<number> {
		return this.postRepository.countByCommunityId(communityId);
	}

	async getTrendingTags(limit: number, timeWindowHours: number): Promise<TrendingTag[]> {
		return this.postRepository.getTrendingTags(limit, timeWindowHours);
	}
}
