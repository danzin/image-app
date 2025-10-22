import { inject, injectable } from "tsyringe";
import { UnitOfWork } from "../database/UnitOfWork";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { createError } from "../utils/errors";

@injectable()
export class FavoriteService {
	constructor(
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork
	) {}

	async addFavorite(userId: string, postId: string): Promise<void> {
		return this.unitOfWork.executeInTransaction(async (session) => {
			const existing = await this.favoriteRepository.findByUserAndPost(userId, postId, session);
			if (existing) {
				throw createError("DuplicateError", "Post already in favorites");
			}

			await this.favoriteRepository.create({ userId, postId } as any, session);
		});
	}

	async removeFavorite(userId: string, postId: string): Promise<void> {
		return this.unitOfWork.executeInTransaction(async (session) => {
			const wasRemoved = await this.favoriteRepository.remove(userId, postId, session);
			if (!wasRemoved) {
				throw createError("NotFoundError", "Favorite not found");
			}
		});
	}
}
