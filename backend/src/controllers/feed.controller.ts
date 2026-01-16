import { NextFunction, Request, Response } from "express";
import { FeedService } from "../services/feed.service";
import { inject, injectable } from "tsyringe";
import { createError } from "../utils/errors";
import { QueryBus } from "../application/common/buses/query.bus";
import { GetTrendingTagsQuery } from "../application/queries/tags/getTrendingTags/getTrendingTags.query";
import { GetPersonalizedFeedQuery } from "../application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.query";
import { GetForYouFeedQuery } from "../application/queries/feed/getForYouFeed/getForYouFeed.query";
import { GetTrendingFeedQuery } from "../application/queries/feed/getTrendingFeed/getTrendingFeed.query";
@injectable()
export class FeedController {
	constructor(
		@inject("FeedService") private readonly feedService: FeedService,
		@inject("QueryBus") private readonly queryBus: QueryBus
	) {}

	getFeed = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { page, limit } = req.query;
			if (!req.decodedUser || !req.decodedUser.publicId) {
				throw createError("ValidationError", "User public ID is required");
			}

			const query = new GetPersonalizedFeedQuery(req.decodedUser.publicId, Number(page) || 1, Number(limit) || 20);
			const feed = await this.queryBus.execute(query);
			res.json(feed);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getForYouFeed = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { page, limit } = req.query;
			if (!req.decodedUser || !req.decodedUser.publicId) {
				throw createError("ValidationError", "User public ID is required");
			}
			const query = new GetForYouFeedQuery(req.decodedUser.publicId, Number(page) || 1, Number(limit) || 20);
			const feed = await this.queryBus.execute(query);
			res.json(feed);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getTrendingFeed = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const page = Number(req.query.page) || 1;
			const limit = Number(req.query.limit) || 20;

			const query = new GetTrendingFeedQuery(page, limit);
			const feed = await this.queryBus.execute(query);

			res.json(feed);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getNewFeed = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const page = Number(req.query.page) || 1;
			const limit = Number(req.query.limit) || 20;
			const refresh = req.query.refresh === "true";
			const isAuthenticated = !!(req as any).decodedUser;

			// only allow cache bypass for authenticated users requesting a refresh
			const forceRefresh = refresh && isAuthenticated;

			const feed = await this.feedService.getNewFeed(page, limit, forceRefresh);
			res.json(feed);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getTrendingTags = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const limit = Number(req.query.limit) || 5;
			const timeWindowHours = Number(req.query.timeWindowHours) || 168; // 7 days default

			const query = new GetTrendingTagsQuery(limit, timeWindowHours);
			const result = await this.queryBus.execute(query);

			res.json(result);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};
}
