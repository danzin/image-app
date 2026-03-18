import express from "express";
import { asyncHandler } from "@/middleware/async-handler.middleware";
import { SearchController } from "@/controllers/search.controller";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/types/tokens";

@injectable()
export class SearchRoutes {
  public router: express.Router;

  constructor(
    @inject(TOKENS.Controllers.Search) private controller: SearchController,
  ) {
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get("/", asyncHandler(this.controller.searchAll));
  }

  public getRouter(): express.Router {
    return this.router;
  }
}
