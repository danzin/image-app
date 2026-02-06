import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";
import { UnitOfWork } from "@/database/UnitOfWork";
import { FavoriteRepository } from "@/repositories/favorite.repository";
import { UserRepository } from "@/repositories/user.repository";
import { PostRepository } from "@/repositories/post.repository";
import { DTOService } from "./dto.service";
import { IFavorite, PaginationResult, PostDTO } from "@/types";
import { createError } from "@/utils/errors";

@injectable()
export class FavoriteService {
	constructor(
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async addFavorite(userId: string, postId: string): Promise<void> {
		return this.unitOfWork.executeInTransaction(async (session) => {
			const existing = await this.favoriteRepository.findByUserAndPost(userId, postId, session);
			if (existing) {
				throw createError("DuplicateError", "Post already in favorites");
			}

			const favoriteData: Partial<IFavorite> = {
				userId: new mongoose.Types.ObjectId(userId),
				postId: new mongoose.Types.ObjectId(postId),
			};
			await this.favoriteRepository.create(favoriteData, session);
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

	async addFavoriteByPublicIds(actorPublicId: string, postPublicId: string): Promise<void> {
		const actorId = await this.userRepository.findInternalIdByPublicId(actorPublicId);
		if (!actorId) {
			throw createError("NotFoundError", "User not found");
		}

		const postId = await this.postRepository.findInternalIdByPublicId(postPublicId);
		if (!postId) {
			throw createError("NotFoundError", "Post not found");
		}

		await this.addFavorite(actorId, postId);
	}

	async removeFavoriteByPublicIds(actorPublicId: string, postPublicId: string): Promise<void> {
		const actorId = await this.userRepository.findInternalIdByPublicId(actorPublicId);
		if (!actorId) {
			throw createError("NotFoundError", "User not found");
		}

		const postId = await this.postRepository.findInternalIdByPublicId(postPublicId);
		if (!postId) {
			throw createError("NotFoundError", "Post not found");
		}

		await this.removeFavorite(actorId, postId);
	}

	async removeFavoriteAdmin(userPublicId: string, postPublicId: string): Promise<void> {
		const userId = await this.userRepository.findInternalIdByPublicId(userPublicId);
		if (!userId) {
			throw createError("NotFoundError", "User not found");
		}

		const postId = await this.postRepository.findInternalIdByPublicId(postPublicId);
		if (!postId) {
			throw createError("NotFoundError", "Post not found");
		}

		return this.unitOfWork.executeInTransaction(async (session) => {
			await this.favoriteRepository.remove(userId, postId, session);
		});
	}

	async getFavoritesForViewer(viewerPublicId: string, page: number, limit: number): Promise<PaginationResult<PostDTO>> {
		const userId = await this.userRepository.findInternalIdByPublicId(viewerPublicId);
		if (!userId) {
			throw createError("NotFoundError", "User not found");
		}

		const safePage = Math.max(1, page);
		const safeLimit = Math.max(1, limit);
		const { data, total } = await this.favoriteRepository.findFavoritesByUserId(userId, safePage, safeLimit);

		const dtos = data.map((post) => {
			const plain = this.ensurePlain(post);
			plain.isFavoritedByViewer = true;
			if (plain.isLikedByViewer === undefined) {
				plain.isLikedByViewer = false;
			}
			return this.dtoService.toPostDTO(plain);
		});

		return {
			data: dtos,
			total,
			page: safePage,
			limit: safeLimit,
			totalPages: Math.ceil(total / safeLimit),
		};
	}

	private ensurePlain(entry: any): any {
		if (entry && typeof entry.toObject === "function") {
			return entry.toObject();
		}
		return entry;
	}
}
