import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPostsQuery } from "./getPosts.query";
import { FeedService } from "../../../../services/feed.service";
import { PaginationResult, PostDTO } from "../../../../types";

@injectable()
export class GetPostsQueryHandler implements IQueryHandler<GetPostsQuery, PaginationResult<PostDTO>> {
	constructor(@inject("FeedService") private readonly feedService: FeedService) {}

	async execute(query: GetPostsQuery): Promise<PaginationResult<PostDTO>> {
		// use personalized feed for authenticated users
		// for anonymous users, fall back to trending feed
		if (query.userId) {
			console.log(`[GetPostsQuery] Fetching personalized feed for user ${query.userId}`);
			return await this.feedService.getPersonalizedFeed(query.userId, query.page, query.limit);
		} else {
			console.log("[GetPostsQuery] Fetching trending feed for anonymous user");
			// anonymous users get trending feed as home feed
			return await this.feedService.getTrendingFeed(query.page, query.limit);
		}
	}
}
