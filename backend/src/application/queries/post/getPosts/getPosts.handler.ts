import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPostsQuery } from "./getPosts.query";
import { FeedService } from "../../../../services/feed.service";
import { PaginationResult, PostDTO } from "../../../../types";
import { QueryBus } from "../../../common/buses/query.bus";
import { GetTrendingFeedQuery } from "../../feed/getTrendingFeed/getTrendingFeed.query";

@injectable()
export class GetPostsQueryHandler implements IQueryHandler<GetPostsQuery, PaginationResult<PostDTO>> {
	constructor(
		@inject("FeedService") private readonly feedService: FeedService,
		@inject("QueryBus") private readonly queryBus: QueryBus
	) {}

	async execute(query: GetPostsQuery): Promise<PaginationResult<PostDTO>> {
		// use personalized feed for authenticated users
		// for anonymous users, fall back to trending feed
		if (query.userId) {
			console.log(`[GetPostsQuery] Fetching personalized feed for user ${query.userId}`);
			return await this.feedService.getPersonalizedFeed(query.userId, query.page, query.limit);
		} else {
			console.log("[GetPostsQuery] Fetching trending feed for anonymous user");
			// anonymous users get trending feed as home feed (from worker-computed sorted set)
			const trendingQuery = new GetTrendingFeedQuery(query.page, query.limit);
			return await this.queryBus.execute(trendingQuery);
		}
	}
}
