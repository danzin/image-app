import { NextFunction, Request, Response } from "express";
import { FeedService } from "../services/feed.service";
import { inject, injectable } from "tsyringe";
import { createError } from "../utils/errors";

@injectable()
export class FeedController {
	constructor(@inject("FeedService") private readonly feedService: FeedService) {}

	getFeed = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { page, limit } = req.query;
			if (!req.decodedUser || !req.decodedUser.publicId) {
				throw createError("ValidationError", "User public ID is required");
			}
			const feed = await this.feedService.getPersonalizedFeed(req.decodedUser.publicId, Number(page), Number(limit));
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
}
