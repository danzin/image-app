import { Request, Response } from "express";
import { FeedService } from "@/services/feed/feed.service";
import { inject, injectable } from "tsyringe";
import { Errors } from "@/utils/errors";
import { QueryBus } from "@/application/common/buses/query.bus";
import { GetTrendingTagsQuery } from "@/application/queries/tags/getTrendingTags/getTrendingTags.query";
import { GetPersonalizedFeedQuery } from "@/application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.query";
import { GetForYouFeedQuery } from "@/application/queries/feed/getForYouFeed/getForYouFeed.query";
import { GetTrendingFeedQuery } from "@/application/queries/feed/getTrendingFeed/getTrendingFeed.query";
import {
  streamPaginatedResponse,
  streamCursorResponse,
} from "@/utils/streamResponse";
import { CursorPaginationResult, FeedPost } from "@/types";
import { TOKENS } from "@/types/tokens";

/** Threshold for enabling streaming responses (items) */
import { STREAM_THRESHOLD } from "@/utils/post-helpers";

@injectable()
export class FeedController {
  constructor(
    @inject(TOKENS.Services.Feed) private readonly feedService: FeedService,
    @inject(TOKENS.CQRS.Queries.Bus) private readonly queryBus: QueryBus,
  ) {}

  getFeed = async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    if (!req.decodedUser || !req.decodedUser.publicId) {
      throw Errors.validation("User public ID is required");
    }

    const query = new GetPersonalizedFeedQuery(
      req.decodedUser.publicId,
      Number(page) || 1,
      Math.min(Number(limit) || 20, 100),
      cursor,
    );
    const feed =
      await this.queryBus.execute<CursorPaginationResult<FeedPost>>(query);

    // Use streaming for large responses with cursor pagination
    if (feed.data && feed.data.length >= STREAM_THRESHOLD) {
      streamCursorResponse(res, feed.data, {
        hasMore: feed.hasMore,
        nextCursor: feed.nextCursor,
      });
    } else {
      res.json(feed);
    }
  };

  getForYouFeed = async (req: Request, res: Response) => {
    const { page, limit } = req.query;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    if (!req.decodedUser || !req.decodedUser.publicId) {
      throw Errors.validation("User public ID is required");
    }
    const query = new GetForYouFeedQuery(
      req.decodedUser.publicId,
      Number(page) || 1,
      Math.min(Number(limit) || 20, 100),
      cursor,
    );
    const feed =
      await this.queryBus.execute<CursorPaginationResult<FeedPost>>(query);

    // Use streaming for large responses with cursor pagination
    if (feed.data && feed.data.length >= STREAM_THRESHOLD) {
      streamCursorResponse(res, feed.data, {
        hasMore: feed.hasMore,
        nextCursor: feed.nextCursor,
      });
    } else {
      res.json(feed);
    }
  };

  getTrendingFeed = async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;

    const query = new GetTrendingFeedQuery(page, limit, cursor);
    const feed =
      await this.queryBus.execute<CursorPaginationResult<FeedPost>>(query);

    // Use streaming for large responses with cursor pagination
    if (feed.data && feed.data.length >= STREAM_THRESHOLD) {
      streamCursorResponse(res, feed.data, {
        hasMore: feed.hasMore,
        nextCursor: feed.nextCursor,
      });
    } else {
      res.json(feed);
    }
  };

  getNewFeed = async (req: Request, res: Response) => {
    const page = Number(req.query.page) || 1;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const refresh = req.query.refresh === "true";
    const isAuthenticated = !!req.decodedUser;

    // only allow cache bypass for authenticated users requesting a refresh
    const forceRefresh = refresh && isAuthenticated;

    const feed = await this.feedService.getNewFeed(
      page,
      limit,
      forceRefresh,
      cursor,
    );

    // Use cursor-based streaming if cursor is available
    if (feed.nextCursor && feed.data && feed.data.length >= STREAM_THRESHOLD) {
      streamCursorResponse(res, feed.data, {
        hasMore: feed.data.length >= limit,
        nextCursor: feed.nextCursor,
      });
    } else if (feed.data && feed.data.length >= STREAM_THRESHOLD) {
      streamPaginatedResponse(res, feed.data, {
        total: feed.total,
        page: feed.page,
        limit: feed.limit,
        totalPages: feed.totalPages,
      });
    } else {
      res.json(feed);
    }
  };

  getTrendingTags = async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 5, 50);
    const timeWindowHours = Number(req.query.timeWindowHours) || 168; // 7 days default

    const query = new GetTrendingTagsQuery(limit, timeWindowHours);
    const result = await this.queryBus.execute(query);

    res.json(result);
  };
}
