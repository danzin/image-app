import mongoose, { Model } from "mongoose";
import { UserRepository } from "../repositories/user.repository";
import type { IImageStorageService, IUser, PaginationOptions, PaginationResult } from "../types";
import { ImageRepository } from "../repositories/image.repository";
import { PostRepository } from "../repositories/post.repository";
import { createError } from "../utils/errors";
import jwt from "jsonwebtoken";
import { injectable, inject } from "tsyringe";
import { UnitOfWork } from "../database/UnitOfWork";
import { LikeRepository } from "../repositories/like.repository";
import { FollowRepository } from "../repositories/follow.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { NotificationService } from "./notification.service";
import { EventBus } from "../application/common/buses/event.bus";

import { DTOService, PublicUserDTO, AdminUserDTO } from "./dto.service";
import { FeedService } from "./feed.service";
import { RedisService } from "./redis.service";

// TODO: REFACTOR AND REMOVE OLD METHODS

/**
 * UserService handles all user-related operations, including authentication, profile updates,
 * and interactions such as following and liking images.
 */
@injectable()
export class UserService {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("ImageRepository")
		private readonly imageRepository: ImageRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("ImageStorageService")
		private readonly imageStorageService: IImageStorageService,
		@inject("UserModel") private readonly userModel: Model<IUser>,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("LikeRepository") private readonly likeRepository: LikeRepository,
		@inject("FollowRepository")
		private readonly followRepository: FollowRepository,
		@inject("UserActionRepository")
		private readonly userActionRepository: UserActionRepository,
		@inject("NotificationService")
		private readonly notificationService: NotificationService,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("FeedService") private readonly feedService: FeedService,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("EventBus") private eventBus: EventBus
	) {}

	/**
	 * Generates a JWT token for a user.
	 * @param user - The user object
	 * @returns A signed JWT token
	 */
	private generateToken(user: IUser): string {
		// Token intentionally exposes only public-facing identifiers.
		const payload = {
			publicId: user.publicId,
			email: user.email,
			username: user.username,
			isAdmin: user.isAdmin,
		};
		const secret = process.env.JWT_SECRET;
		if (!secret) throw createError("ConfigError", "JWT secret is not configured");
		return jwt.sign(payload, secret, { expiresIn: "12h" });
	}

	/**
	 * Registers a new user and returns the user DTO along with an authentication token.
	 * @param userData - Partial user data
	 * @returns The created user and authentication token
	 */
	async register(userData: Partial<IUser>): Promise<{ user: PublicUserDTO; token: string }> {
		try {
			const user = await this.userRepository.create(userData);
			const token = this.generateToken(user);

			// New users always get public DTO
			const enrichedUser = await this.attachPostCount(user);
			const userDTO = this.dtoService.toPublicDTO(enrichedUser);

			return { user: userDTO, token };
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				throw createError(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message
				);
			} else {
				throw createError("InternalServerError", "An unknown error occurred.");
			}
		}
	}

	/**
	 * Authenticates a user and returns their data along with a token.
	 * @param email - User's email
	 * @param password - User's password
	 * @returns The authenticated user and token
	 */
	async login(email: string, password: string): Promise<{ user: PublicUserDTO | AdminUserDTO; token: string }> {
		try {
			const user = await this.userRepository.findByEmail(email);
			if (!user || !(await user.comparePassword?.(password))) {
				throw createError("AuthenticationError", "Invalid email or password");
			}

			const token = this.generateToken(user);
			const enrichedUser = await this.attachPostCount(user);

			// Assign appropriate DTO
			const userDTO = user.isAdmin
				? this.dtoService.toAdminDTO(enrichedUser)
				: this.dtoService.toPublicDTO(enrichedUser);

			return { user: userDTO, token };
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				throw createError(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message
				);
			} else {
				throw createError("InternalServerError", "An unknown error occurred.");
			}
		}
	}

	/**
	 * Retrieves the authenticated user's profile.
	 * @param user - The user object (partial).
	 * @returns The user's updated profile (DTO) and a refreshed token.
	 */
	async getMe(user: Partial<IUser>): Promise<{ user: PublicUserDTO; token: string }> {
		try {
			let freshUser: IUser | null = null;
			if (user.publicId) {
				freshUser = await this.userRepository.findByPublicId(user.publicId);
			} else if (user.id) {
				freshUser = await this.userRepository.findById(user.id as string);
			}
			if (!freshUser) throw createError("PathError", "User not found");
			const token = this.generateToken(freshUser);
			const enrichedUser = await this.attachPostCount(freshUser);
			return { user: this.dtoService.toPublicDTO(enrichedUser), token };
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				throw createError(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message
				);
			}
			throw createError("InternalServerError", "An unknown error occurred.");
		}
	}

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

	async getPublicProfileByPublicId(publicId: string): Promise<PublicUserDTO> {
		const user = await this.getUserByPublicId(publicId);
		const enrichedUser = await this.attachPostCount(user);
		return this.dtoService.toPublicDTO(enrichedUser);
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

	async getPublicProfileByUsername(username: string): Promise<PublicUserDTO> {
		const user = await this.getUserByUsername(username);
		const enrichedUser = await this.attachPostCount(user);
		return this.dtoService.toPublicDTO(enrichedUser);
	}

	/**
	 * Updates a user's profile details by public identifier.
	 */
	async updateProfileByPublicId(
		publicId: string,
		userData: Partial<IUser>,
		requestingUser?: IUser
	): Promise<PublicUserDTO | AdminUserDTO> {
		const targetUser = await this.userRepository.findByPublicId(publicId);
		if (!targetUser) {
			throw createError("NotFoundError", "User not found");
		}

		const allowedUpdates: Record<string, unknown> = {};
		if (typeof userData.username === "string") {
			const trimmed = userData.username.trim();
			if (trimmed && trimmed !== targetUser.username) {
				allowedUpdates.username = trimmed;
			}
		}
		if (typeof userData.bio === "string") {
			allowedUpdates.bio = userData.bio.trim();
		}

		if (Object.keys(allowedUpdates).length === 0) {
			throw createError("ValidationError", "No valid fields provided for update");
		}

		let updatedUser: IUser | null = null;
		await this.unitOfWork.executeInTransaction(async (session) => {
			updatedUser = await this.userRepository.update(targetUser.id, { $set: allowedUpdates }, session);
			if (!updatedUser) {
				throw createError("NotFoundError", "User not found during update");
			}
			await this.userActionRepository.logAction(targetUser.id, "profile_update", targetUser.id, session);
		});

		if (!updatedUser) {
			throw createError("InternalServerError", "Profile update failed unexpectedly");
		}

		const enrichedUser = await this.attachPostCount(updatedUser);
		return requestingUser?.isAdmin
			? this.dtoService.toAdminDTO(enrichedUser)
			: this.dtoService.toPublicDTO(enrichedUser);
	}

	/**
	 * Changes the password for a user identified by publicId after validating the current password.
	 */

	// TODO: REMEMBER TO MAKE PASSWORD MINIMUM 8 CHARACTERS LONG LATER
	async changePasswordByPublicId(publicId: string, currentPassword: string, newPassword: string): Promise<void> {
		if (!newPassword || newPassword.length < 3) {
			throw createError("ValidationError", "Password must be at least 3 characters long");
		}
		if (currentPassword === newPassword) {
			throw createError("ValidationError", "New password must be different from the current password");
		}

		await this.unitOfWork.executeInTransaction(async (session) => {
			const user = await this.userModel
				.findOne({ publicId })
				.select("+password")
				.session(session ?? undefined)
				.exec();
			if (!user) {
				throw createError("NotFoundError", "User not found");
			}
			if (typeof user.comparePassword !== "function") {
				throw createError("InternalServerError", "Password comparison not available for user");
			}
			const passwordMatches = await user.comparePassword(currentPassword);
			if (!passwordMatches) {
				throw createError("AuthenticationError", "Current password is incorrect");
			}

			await this.userRepository.update(user.id, { $set: { password: newPassword } }, session);
			await this.userActionRepository.logAction(user.id, "password_change", user.id, session);
		});
	}

	/**
	 * Retrieves a user by ID.
	 * If the requesting user is an admin, it returns an admin DTO; otherwise, it returns a public DTO.
	 * @param id - The ID of the user to retrieve.
	 * @param requestingUser - (Optional) The user making the request (used to determine admin privileges).
	 * @returns The user's data in either admin or public DTO format.
	 * @throws NotFoundError if the user is not found.
	 */
	async getUserById(id: string, requestingUser?: IUser): Promise<PublicUserDTO | AdminUserDTO> {
		try {
			const user = await this.userRepository.findById(id);
			if (!user) {
				throw createError("NotFoundError", "User not found");
			}
			const enrichedUser = await this.attachPostCount(user);

			// Return admin DTO if requesting user is admin
			if (requestingUser?.isAdmin) {
				return this.dtoService.toAdminDTO(enrichedUser);
			}
			return this.dtoService.toPublicDTO(enrichedUser);
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				throw createError(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message
				);
			} else {
				throw createError("InternalServerError", "An unknown error occurred.");
			}
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

	/**
	 * Handles user "follow" or "unfollow" actions.
	 * If the user is already following the target user, it removes the follow.
	 * Otherwise, it adds a follow and triggers a notification.
	 * @param followerId - The ID of the user initiating the action.
	 * @param followeeId - The ID of the user being followed/unfollowed.
	 * @throws TransactionError if the database transaction fails.
	 */
	async followAction(followerId: string, followeeId: string): Promise<void> {
		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const isFollowing = await this.followRepository.isFollowing(followerId, followeeId);

				if (isFollowing) {
					// Unfollow logic
					await this.followRepository.removeFollow(followerId, followeeId, session);
					await this.userRepository.update(followerId, { $pull: { following: followeeId } }, session);
					await this.userRepository.update(followeeId, { $pull: { followers: followerId } }, session);
					await this.userActionRepository.logAction(followerId, "unfollow", followeeId, session);
				} else {
					// Follow logic
					await this.followRepository.addFollow(followerId, followeeId, session);
					await this.userRepository.update(followerId, { $addToSet: { following: followeeId } }, session);
					await this.userRepository.update(followeeId, { $addToSet: { followers: followerId } }, session);
					await this.userActionRepository.logAction(followerId, "follow", followeeId, session);

					// for now I'll emit the websocket event inside the transaction
					await this.notificationService.createNotification({
						receiverId: followeeId,
						actionType: "follow",
						actorId: followerId,
						session,
					});
				}
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("TransactionError", errorMessage, {
				function: "likeAction",
				additionalInfo: "Transaction failed",
				originalError: error,
			});
		}
	}

	// Adapter: follow action where follower is provided as publicId (legacy followeeId remains internal id)
	async followActionByPublicId(followerPublicId: string, followeePublicId: string): Promise<void> {
		const follower = await this.userRepository.findByPublicId(followerPublicId);
		const followee = await this.userRepository.findByPublicId(followeePublicId);
		if (!follower) throw createError("NotFoundError", "Follower not found");
		if (!followee) throw createError("NotFoundError", "Followee not found");
		return this.followAction(follower.id, followee.id);
	}

	// === ADMIN METHODS ===

	/**
	 * Gets detailed statistics for a specific user
	 */

	/**
	 * Retrieves a paginated list of all users, including admin details.
	 * Converts user data into admin DTO format before returning.
	 * @param options - Pagination options (page number, limit, sorting).
	 * @returns A paginated result containing users in admin DTO format.
	 */
	async getAllUsersAdmin(options: PaginationOptions): Promise<PaginationResult<AdminUserDTO>> {
		const result = await this.userRepository.findWithPagination(options);

		return {
			data: result.data.map((user) => this.dtoService.toAdminDTO(user)),
			total: result.total,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages,
		};
	}

	async getAdminUserProfile(publicId: string): Promise<AdminUserDTO> {
		const user = await this.getUserByPublicId(publicId);
		const enrichedUser = await this.attachPostCount(user);
		return this.dtoService.toAdminDTO(enrichedUser);
	}

	/**
	 * Gets recent user activity for admin dashboard
	 */
	async getRecentActivity(options: PaginationOptions) {
		const activities = await this.userActionRepository.findWithPagination({
			...options,
			sortBy: "timestamp",
			sortOrder: "desc",
		});

		// transform the data to match frontend expectations
		const transformedData = activities.data.map((activity: any) => ({
			userId: activity.userId?._id?.toString() || activity.userId?.toString() || "",
			username: activity.userId?.username || "Unknown",
			action: activity.actionType || "unknown",
			targetType: this.getTargetType(activity.actionType),
			targetId: activity.targetId?.toString() || "",
			timestamp: activity.timestamp || new Date(),
		}));

		return {
			data: transformedData,
			total: activities.total,
			page: activities.page,
			limit: activities.limit,
			totalPages: activities.totalPages,
		};
	}

	/**
	 * Helper to determine target type from action type
	 */
	private getTargetType(actionType: string): string {
		const actionMap: Record<string, string> = {
			upload: "image",
			like: "image",
			comment: "image",
			follow: "user",
			unfollow: "user",
			favorite: "image",
			unfavorite: "image",
		};
		return actionMap[actionType] || "unknown";
	}

	async getUserStats(userId: string) {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const [imageCount, followerCount, followingCount, likeCount] = await Promise.all([
			this.imageRepository.countDocuments({ user: userId }),
			this.followRepository.countDocuments({ followee: userId }),
			this.followRepository.countDocuments({ follower: userId }),
			this.likeRepository.countDocuments({ user: userId }),
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

	// PublicId wrapper for stats
	async getUserStatsByPublicId(publicId: string) {
		const user = await this.userRepository.findByPublicId(publicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.getUserStats(user.id);
	}

	async banUserByPublicId(publicId: string, adminPublicId: string, reason: string): Promise<any> {
		const user = await this.userRepository.findByPublicId(publicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		const adminInternalId = await this.userRepository.findInternalIdByPublicId(adminPublicId);
		if (!adminInternalId) throw createError("NotFoundError", "Admin not found");
		const updatedUser = await this.userRepository.update(String(user._id), {
			isBanned: true,
			bannedAt: new Date(),
			bannedReason: reason,
			bannedBy: adminInternalId,
		});
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during ban");
		}
		const enrichedUser = await this.attachPostCount(updatedUser);
		return { message: "User banned successfully", user: this.dtoService.toAdminDTO(enrichedUser) };
	}

	/**
	 * Unbans a user
	 */
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

	async unbanUserByPublicId(publicId: string) {
		const user = await this.userRepository.findByPublicId(publicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.unbanUser(user.id);
	}

	/**
	 * Gets dashboard statistics for admin
	 */
	async getDashboardStats() {
		const [totalUsers, totalImages, bannedUsers, adminUsers, recentUsers, recentImages] = await Promise.all([
			this.userRepository.countDocuments({}),
			this.imageRepository.countDocuments({}),
			this.userRepository.countDocuments({ isBanned: true }),
			this.userRepository.countDocuments({ isAdmin: true }),
			this.userRepository.countDocuments({
				createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
			}),
			this.imageRepository.countDocuments({
				createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
			}),
		]);

		return {
			totalUsers,
			totalImages,
			bannedUsers,
			adminUsers,
			recentUsers,
			recentImages,
			growthRate: {
				users: recentUsers,
				images: recentImages,
			},
		};
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

	async promoteToAdminByPublicId(publicId: string) {
		const user = await this.userRepository.findByPublicId(publicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.promoteToAdmin(user.id);
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

	async demoteFromAdminByPublicId(publicId: string) {
		const user = await this.userRepository.findByPublicId(publicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.demoteFromAdmin(user.id);
	}

	private async attachPostCount(user: IUser): Promise<IUser> {
		await this.ensurePostCount(user);
		await this.attachFollowCounts(user);
		return user;
	}

	private async ensurePostCount(user: IUser): Promise<void> {
		const userWithAny = user as any;
		if (typeof userWithAny.postCount === "number" && Number.isFinite(userWithAny.postCount)) {
			return;
		}

		const cacheKey = user.publicId ? `user:${user.publicId}:postCount` : null;
		if (cacheKey) {
			try {
				const cachedCount = await this.redisService.getWithTags<number>(cacheKey);
				if (typeof cachedCount === "number" && Number.isFinite(cachedCount)) {
					userWithAny.postCount = cachedCount;
					return;
				}
			} catch (error) {
				console.warn("post count cache lookup failed", {
					publicId: user.publicId,
					error,
				});
			}
		}

		const identifier = userWithAny._id ?? userWithAny.id;
		if (!identifier) {
			return;
		}

		try {
			const normalizedId = this.normalizeToObjectId(identifier);
			if (!normalizedId) {
				return;
			}

			const postCount = await this.postRepository.countDocuments({ user: normalizedId });
			userWithAny.postCount = postCount;

			if (cacheKey) {
				try {
					await this.redisService.setWithTags(cacheKey, postCount, [`user_post_count:${user.publicId}`], 300);
				} catch (cacheError) {
					console.warn("post count cache write failed", {
						publicId: user.publicId,
						error: cacheError,
					});
				}
			}
		} catch (error) {
			console.warn("failed to derive post count for user", {
				userId: identifier,
				error,
			});
		}
	}

	private async attachFollowCounts(user: IUser): Promise<void> {
		const userWithAny = user as any;
		if (
			typeof userWithAny.followerCount === "number" &&
			Number.isFinite(userWithAny.followerCount) &&
			typeof userWithAny.followingCount === "number" &&
			Number.isFinite(userWithAny.followingCount)
		) {
			return;
		}

		if (!user.publicId) {
			return;
		}

		const cacheKey = `user:${user.publicId}:followStats`;
		try {
			const cached = await this.redisService.getWithTags<{ followerCount?: number; followingCount?: number }>(cacheKey);
			if (cached) {
				if (typeof cached.followerCount === "number" && Number.isFinite(cached.followerCount)) {
					userWithAny.followerCount = cached.followerCount;
				}
				if (typeof cached.followingCount === "number" && Number.isFinite(cached.followingCount)) {
					userWithAny.followingCount = cached.followingCount;
				}
				if (
					typeof userWithAny.followerCount === "number" &&
					Number.isFinite(userWithAny.followerCount) &&
					typeof userWithAny.followingCount === "number" &&
					Number.isFinite(userWithAny.followingCount)
				) {
					return;
				}
			}
		} catch (error) {
			console.warn("follow count cache lookup failed", {
				publicId: user.publicId,
				error,
			});
		}

		const identifier = userWithAny._id ?? userWithAny.id;
		const normalizedId = this.normalizeToObjectId(identifier);
		if (!normalizedId) {
			return;
		}

		try {
			const [followers, following] = await Promise.all([
				this.followRepository.countFollowersByUserId(normalizedId),
				this.followRepository.countFollowingByUserId(normalizedId),
			]);
			userWithAny.followerCount = followers;
			userWithAny.followingCount = following;

			try {
				await this.redisService.setWithTags(
					cacheKey,
					{ followerCount: followers, followingCount: following },
					[`user_follow_count:${user.publicId}`],
					300
				);
			} catch (cacheError) {
				console.warn("follow count cache write failed", {
					publicId: user.publicId,
					error: cacheError,
				});
			}
		} catch (error) {
			console.warn("failed to derive follow counts for user", {
				userId: normalizedId?.toString(),
				error,
			});
		}
	}

	private normalizeToObjectId(identifier: unknown): mongoose.Types.ObjectId | null {
		if (!identifier) {
			return null;
		}
		if (identifier instanceof mongoose.Types.ObjectId) {
			return identifier;
		}
		try {
			return new mongoose.Types.ObjectId(String(identifier));
		} catch {
			return null;
		}
	}

	// === SECURE PUBLIC ID METHODS ===

	/**
	 * Public adapter: Toggles follow status using public IDs
	 * This is the method the controller should call
	 */
	async toggleFollow(
		followerPublicId: string,
		followeePublicId: string
	): Promise<{ action: "followed" | "unfollowed" }> {
		const [follower, followee] = await Promise.all([
			this.userRepository.findByPublicId(followerPublicId),
			this.userRepository.findByPublicId(followeePublicId),
		]);

		if (!follower || !followee) {
			throw createError("NotFoundError", "One or both users not found");
		}

		if (follower.id === followee.id) {
			throw createError("ValidationError", "Cannot follow yourself");
		}

		const wasFollowing = await this.followRepository.isFollowing(follower.id, followee.id);
		await this.followAction(follower.id, followee.id);

		return { action: wasFollowing ? "unfollowed" : "followed" };
	}
	/**
	 * Checks if current user is following another user by public ID
	 */
	async checkFollowStatusByPublicId(followerPublicId: string, targetPublicId: string): Promise<boolean> {
		try {
			const isFollowing = await this.followRepository.isFollowingByPublicId(followerPublicId, targetPublicId);
			return isFollowing;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}
}
