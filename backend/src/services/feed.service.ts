import { inject, injectable } from "tsyringe";
import { PaginationResult, PostDTO } from "@/types";
import { FeedReadService } from "./feed/feed-read.service";
import { FeedInteractionService } from "./feed/feed-interaction.service";
import { FeedMetaService } from "./feed/feed-meta.service";
import { FeedFanoutService } from "./feed/feed-fanout.service";

@injectable()
export class FeedService {
	constructor(
		@inject("FeedReadService") private readonly feedReadService: FeedReadService,
		@inject("FeedInteractionService") private readonly feedInteractionService: FeedInteractionService,
		@inject("FeedMetaService") private readonly feedMetaService: FeedMetaService,
		@inject("FeedFanoutService") private readonly feedFanoutService: FeedFanoutService,
	) {}

	public async getPersonalizedFeed(userId: string, page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		return this.feedReadService.getPersonalizedFeed(userId, page, limit);
	}

	public async getTrendingFeed(page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		return this.feedReadService.getTrendingFeed(page, limit);
	}

	public async getNewFeed(
		page: number,
		limit: number,
		forceRefresh = false,
		cursor?: string,
	): Promise<PaginationResult<PostDTO> & { nextCursor?: string }> {
		return this.feedReadService.getNewFeed(page, limit, forceRefresh, cursor);
	}

	public async recordInteraction(
		userPublicId: string,
		actionType: string,
		targetIdentifier: string,
		tags: string[],
	): Promise<void> {
		return this.feedInteractionService.recordInteraction(userPublicId, actionType, targetIdentifier, tags);
	}

	public async updatePostLikeMeta(postPublicId: string, newTotalLikes: number): Promise<void> {
		return this.feedMetaService.updatePostLikeMeta(postPublicId, newTotalLikes);
	}

	public async updatePostViewMeta(postPublicId: string, newViewsCount: number): Promise<void> {
		return this.feedMetaService.updatePostViewMeta(postPublicId, newViewsCount);
	}

	public async updatePostCommentMeta(postPublicId: string, newCommentsCount: number): Promise<void> {
		return this.feedMetaService.updatePostCommentMeta(postPublicId, newCommentsCount);
	}

	public async fanOutPostToFollowers(postId: string, authorId: string, timestamp: number): Promise<void> {
		return this.feedFanoutService.fanOutPostToFollowers(postId, authorId, timestamp);
	}

	public async removePostFromFollowers(postId: string, authorId: string): Promise<void> {
		return this.feedFanoutService.removePostFromFollowers(postId, authorId);
	}

	public async prewarmNewFeed(): Promise<void> {
		return this.feedFanoutService.prewarmNewFeed();
	}
}
