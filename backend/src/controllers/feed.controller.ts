import { NextFunction, Request, Response } from "express";
import { FeedService } from "../services/feed.service";
import { inject, injectable } from "tsyringe";
import { createError } from "../utils/errors";

@injectable()
export class FeedController {

  constructor(
    @inject('FeedService') private readonly feedService: FeedService
  ) {}

   getFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, limit  } = req.query;
      const feed = await this.feedService.getPersonalizedFeed(
        req.decodedUser.id,
        Number(page),
        Number(limit)
      );
      res.json(feed);
    } catch (error) {
      console.error(error)
      next(createError(error.name, error.message));
    } 
  }
}
