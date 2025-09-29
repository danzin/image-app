import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { FavoriteService } from "../services/favorite.service";
import { createError } from "../utils/errors";
import { DTOService } from "../services/dto.service";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";

@injectable()
export class FavoriteController {
	constructor(
		@inject("FavoriteService") private readonly favoriteService: FavoriteService,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	/**
	 *  Add an image to the logged-in user's favorites list.
	 */
	addFavorite = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId: imagePublicId } = req.params; // The TARGET is the image from the URL
			const actorPublicId = req.decodedUser?.publicId; // The ACTOR is the logged-in user from the token

			if (!actorPublicId) {
				throw createError("AuthenticationError", "User must be logged in to favorite an image.");
			}

			const internalActorId = await this.userRepository.findInternalIdByPublicId(actorPublicId);
			const internalImageId = await this.imageRepository.findInternalIdByPublicId(imagePublicId);

			if (!internalActorId || !internalImageId) {
				throw createError("NotFoundError", "User or Image not found");
			}

			await this.favoriteService.addFavorite(internalActorId, internalImageId);
			res.status(204).send(); // 204 No Content is appropriate for a successful action with no body
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Remove an image from the logged-in user's favorites list.
	 */
	removeFavorite = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { publicId: imagePublicId } = req.params; // The TARGET is the image from the URL
			const actorPublicId = req.decodedUser?.publicId; // The ACTOR is the logged-in user

			if (!actorPublicId) {
				throw createError("AuthenticationError", "User must be logged in to unfavorite an image.");
			}

			const internalActorId = await this.userRepository.findInternalIdByPublicId(actorPublicId);
			const internalImageId = await this.imageRepository.findInternalIdByPublicId(imagePublicId);

			if (!internalActorId || !internalImageId) {
				throw createError("NotFoundError", "User or Image not found");
			}

			await this.favoriteService.removeFavorite(internalActorId, internalImageId);
			res.status(204).send();
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Get the list of favorited images for a specific user profile.
	 */
	getFavorites = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const viewerPublicId = req.decodedUser?.publicId; // The VIEWER (actor) is the logged-in user

			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const internalUserId = await this.userRepository.findInternalIdByPublicId(viewerPublicId);
			if (!internalUserId) {
				throw createError("NotFoundError", "User not found");
			}

			const { data, total } = await this.favoriteRepository.findFavoritesByUserId(internalUserId, page, limit);

			const dataWithFlag = data.map((img) => {
				(img as any).isFavoritedByViewer = true;
				return img;
			});

			const imageDTOs = dataWithFlag.map((img) => this.dtoService.toPublicImageDTO(img, viewerPublicId));

			res.status(200).json({
				data: imageDTOs,
				page,
				limit,
				total,
				totalPages: Math.ceil(total / limit),
			});
		} catch (error) {
			next(error);
		}
	};
}
