import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { FavoriteService } from "../services/favorite.service";
import { createError } from "../utils/errors";

@injectable()
export class FavoriteController {
	constructor(@inject("FavoriteService") private readonly favoriteService: FavoriteService) {}

	/**
	 *  Add a post to the logged-in user's favorites list.
	 */
	addFavorite = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const actorPublicId = req.decodedUser?.publicId;
			if (!actorPublicId) {
				throw createError("AuthenticationError", "User must be logged in to favorite a post");
			}

			const sanitizedPostId = req.params.publicId.replace(/\.[a-z0-9]{2,5}$/i, "");

			await this.favoriteService.addFavoriteByPublicIds(actorPublicId, sanitizedPostId);
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Remove a post from the logged-in user's favorites list.
	 */
	removeFavorite = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const actorPublicId = req.decodedUser?.publicId;
			if (!actorPublicId) {
				throw createError("AuthenticationError", "User must be logged in to unfavorite a post");
			}

			const sanitizedPostId = req.params.publicId.replace(/\.[a-z0-9]{2,5}$/i, "");

			await this.favoriteService.removeFavoriteByPublicIds(actorPublicId, sanitizedPostId);
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Get the list of favorited posts for a specific user profile.
	 */
	getFavorites = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const viewerPublicId = req.decodedUser?.publicId;
			if (!viewerPublicId) {
				throw createError("AuthenticationError", "User must be logged in to view favorites");
			}

			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const favorites = await this.favoriteService.getFavoritesForViewer(viewerPublicId, page, limit);
			res.status(200).json(favorites);
		} catch (error) {
			next(error);
		}
	};
}
