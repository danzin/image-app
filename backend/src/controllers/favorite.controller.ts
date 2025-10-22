import { Request, Response, NextFunction } from "express";
import { inject, injectable } from "tsyringe";
import { FavoriteService } from "../services/favorite.service";
import { createError } from "../utils/errors";
import { DTOService } from "../services/dto.service";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { UserRepository } from "../repositories/user.repository";
import { PostRepository } from "../repositories/post.repository";

@injectable()
export class FavoriteController {
	constructor(
		@inject("FavoriteService") private readonly favoriteService: FavoriteService,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	/**
	 *  Add a post to the logged-in user's favorites list.
	 */
	addFavorite = async (req: Request, res: Response, next: NextFunction) => {
		try {
			let { publicId: postPublicId } = req.params; // The TARGET is the post from the URL
			const actorPublicId = req.decodedUser?.publicId; // The ACTOR is the logged-in user from the token

			if (!actorPublicId) {
				throw createError("AuthenticationError", "User must be logged in to favorite a post.");
			}

			// strip file extension for backward compatibility
			postPublicId = postPublicId.replace(/\.[a-z0-9]{2,5}$/i, "");

			const internalActorId = await this.userRepository.findInternalIdByPublicId(actorPublicId);
			const internalPostId = await this.postRepository.findInternalIdByPublicId(postPublicId);

			if (!internalActorId || !internalPostId) {
				throw createError("NotFoundError", "User or Post not found");
			}

			await this.favoriteService.addFavorite(internalActorId, internalPostId);
			res.status(204).send(); // 204 No Content is appropriate for a successful action with no body
		} catch (error) {
			next(error);
		}
	};

	/**
	 * Remove a post from the logged-in user's favorites list.
	 */
	removeFavorite = async (req: Request, res: Response, next: NextFunction) => {
		try {
			let { publicId: postPublicId } = req.params; // The TARGET is the post from the URL
			const actorPublicId = req.decodedUser?.publicId; // The ACTOR is the logged-in user

			if (!actorPublicId) {
				throw createError("AuthenticationError", "User must be logged in to unfavorite a post.");
			}

			// strip file extension for backward compatibility
			postPublicId = postPublicId.replace(/\.[a-z0-9]{2,5}$/i, "");

			const internalActorId = await this.userRepository.findInternalIdByPublicId(actorPublicId);
			const internalPostId = await this.postRepository.findInternalIdByPublicId(postPublicId);

			if (!internalActorId || !internalPostId) {
				throw createError("NotFoundError", "User or Post not found");
			}

			await this.favoriteService.removeFavorite(internalActorId, internalPostId);
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
			const viewerPublicId = req.decodedUser?.publicId; // The VIEWER (actor) is the logged-in user

			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 20;

			const internalUserId = await this.userRepository.findInternalIdByPublicId(viewerPublicId);
			if (!internalUserId) {
				throw createError("NotFoundError", "User not found");
			}

			const { data, total } = await this.favoriteRepository.findFavoritesByUserId(internalUserId, page, limit);

			const dataWithFlag = data.map((post) => {
				(post as any).isFavoritedByViewer = true;
				(post as any).isLikedByViewer = false; // default value
				return post;
			});

			const postDTOs = dataWithFlag.map((post: any) => this.dtoService.toPublicPostDTO(post as any));

			res.status(200).json({
				data: postDTOs,
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
