import { Model } from "mongoose";
import { UserRepository } from "../repositories/user.repository";
import type { IUser, PaginationOptions, PaginationResult } from "../types";
import { ImageRepository } from "../repositories/image.repository";
import { PostLikeRepository } from "../repositories/postLike.repository";
import { createError } from "../utils/errors";
import { injectable, inject } from "tsyringe";
import { UnitOfWork } from "../database/UnitOfWork";
import { FollowRepository } from "../repositories/follow.repository";
import { UserActionRepository } from "../repositories/userAction.repository";

import { DTOService, PublicUserDTO } from "./dto.service";

@injectable()
export class UserService {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("ImageRepository")
		private readonly imageRepository: ImageRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("UserModel") private readonly userModel: Model<IUser>,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("FollowRepository")
		private readonly followRepository: FollowRepository,
		@inject("UserActionRepository")
		private readonly userActionRepository: UserActionRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	/**
	 * Gets user profile by public ID
	 */
	async getUserByPublicId(publicId: string): Promise<IUser> {
		try {
			const user = await this.userRepository.findByPublicId(publicId);
			if (!user) {
				throw createError("NotFoundError", "User not found");
			}
			return user;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Gets user profile by username (for SEO-friendly profile URLs)
	 */
	async getUserByUsername(username: string): Promise<IUser> {
		try {
			const user = await this.userRepository.findByUsername(username);
			if (!user) {
				throw createError("NotFoundError", "User not found");
			}
			return user;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Retrieves a paginated list of users.
	 * Converts user data into public DTO format before returning.
	 * @param options - Pagination options (page number, limit, sorting).
	 * @returns A paginated result containing users in public DTO format.
	 */
	async getUsers(options: PaginationOptions): Promise<PaginationResult<PublicUserDTO>> {
		const result = await this.userRepository.findWithPagination(options);

		return {
			data: result.data.map((user) => this.dtoService.toPublicDTO(user)),
			total: result.total,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages,
		};
	}

	// === ADMIN METHODS ===

	async getUserStats(userId: string) {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const [imageCount, followerCount, followingCount, likeCount] = await Promise.all([
			this.imageRepository.countDocuments({ user: userId }),
			this.followRepository.countDocuments({ followee: userId }),
			this.followRepository.countDocuments({ follower: userId }),
			this.postLikeRepository.countLikesByUser(userId),
		]);

		const enrichedUser = await this.attachPostCount(user);

		return {
			user: this.dtoService.toAdminDTO(enrichedUser),
			stats: {
				imageCount,
				followerCount,
				followingCount,
				likeCount,
				joinDate: user.createdAt,
				lastActivity: user.updatedAt,
			},
		};
	}

	async unbanUser(userId: string) {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		const updatedUser = await this.userRepository.update(userId, {
			isBanned: false,
			bannedAt: null,
			bannedReason: null,
			bannedBy: null,
		});
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during unban.");
		}
		const enrichedUser = await this.attachPostCount(updatedUser);
		return this.dtoService.toAdminDTO(enrichedUser);
	}

	async promoteToAdmin(userId: string) {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		if (user.isAdmin) {
			throw createError("ValidationError", "User is already an admin");
		}
		const updatedUser = await this.userRepository.update(userId, { isAdmin: true });
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during promotion.");
		}
		const enrichedUser = await this.attachPostCount(updatedUser);
		return this.dtoService.toAdminDTO(enrichedUser);
	}

	async demoteFromAdmin(userId: string) {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		if (!user.isAdmin) {
			throw createError("ValidationError", "User is not an admin");
		}
		const updatedUser = await this.userRepository.update(userId, { isAdmin: false });
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during demotion.");
		}
		const enrichedUser = await this.attachPostCount(updatedUser);
		return this.dtoService.toAdminDTO(enrichedUser);
	}

	private async attachPostCount(user: IUser): Promise<IUser> {
		await this.ensurePostCount(user);
		await this.attachFollowCounts(user);
		return user;
	}

	private async ensurePostCount(user: IUser): Promise<void> {
		if (typeof user.postCount !== "number" || !Number.isFinite(user.postCount)) {
			user.postCount = 0;
		}
	}

	private async attachFollowCounts(user: IUser): Promise<void> {
		if (typeof user.followerCount !== "number" || !Number.isFinite(user.followerCount)) {
			user.followerCount = 0;
		}
		if (typeof user.followingCount !== "number" || !Number.isFinite(user.followingCount)) {
			user.followingCount = 0;
		}
	}
}
