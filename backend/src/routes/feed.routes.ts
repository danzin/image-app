import { FeedController } from "../controllers/feed.controller";
import { asyncHandler } from "@/middleware/async-handler.middleware";
import express from "express";
import { AuthFactory } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/types/tokens";

@injectable()
export class FeedRoutes {
  public router: express.Router;
  private auth = AuthFactory.bearerToken().handle();

  constructor(@inject(TOKENS.Controllers.Feed) private controller: FeedController) {
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/", this.auth, asyncHandler(this.controller.getFeed));
    this.router.get(
      "/for-you",
      this.auth,
      asyncHandler(this.controller.getForYouFeed),
    );
    this.router.get("/trending", asyncHandler(this.controller.getTrendingFeed));
    this.router.get("/new", asyncHandler(this.controller.getNewFeed));
    this.router.get(
      "/trending-tags",
      asyncHandler(this.controller.getTrendingTags),
    );
  }

  public getRouter(): express.Router {
    return this.router;
  }
}
