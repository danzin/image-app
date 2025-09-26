import express from "express";
import { FavoriteController } from "../controllers/favorite.controller";
import { AuthFactory } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";

@injectable()
export class FavoriteRoutes {
	private router = express.Router();
	private auth = AuthFactory.bearerToken().handle();

	constructor(@inject("FavoriteController") private readonly favoriteController: FavoriteController) {
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		// Image-based favorite actions (add/remove favorite from specific image)
		this.router.post("/images/:publicId/favorite", this.auth, this.favoriteController.addFavorite);
		this.router.delete("/images/:publicId/favorite", this.auth, this.favoriteController.removeFavorite);

		// User-based favorites listing (get all favorites for a user)
		this.router.get("/users/:publicId/favorites", this.auth, this.favoriteController.getFavorites);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
