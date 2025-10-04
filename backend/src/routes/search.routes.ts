import express from "express";
import { SearchController } from "../controllers/search.controller";
import { inject, injectable } from "tsyringe";

@injectable()
export class SearchRoutes {
	public router: express.Router;

	constructor(@inject("SearchController") private controller: SearchController) {
		this.router = express.Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		this.router.get("/", this.controller.searchAll);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
