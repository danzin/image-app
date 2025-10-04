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

	async addFavorite(userId: string, imageId: string): Promise<void> {
		return this.unitOfWork.executeInTransaction(async (session) => {
			const existing = await this.favoriteRepository.findByUserAndImage(userId, imageId, session);
			if (existing) {
				throw createError("DuplicateError", "Image already in favorites");
			}

			await this.favoriteRepository.create({ userId, imageId } as any, session);
		});
	}

	async removeFavorite(userId: string, imageId: string): Promise<void> {
		return this.unitOfWork.executeInTransaction(async (session) => {
			const wasRemoved = await this.favoriteRepository.remove(userId, imageId, session);
			if (!wasRemoved) {
				throw createError("NotFoundError", "Favorite not found");
			}
		});
	}
}
