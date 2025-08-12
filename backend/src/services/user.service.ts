import { Model } from "mongoose";
import { UserRepository } from "../repositories/user.repository";
import { IImage, IImageStorageService, IUser, PaginationOptions, PaginationResult } from "../types";
import { ImageRepository } from "../repositories/image.repository";
import { createError } from "../utils/errors";
import jwt from "jsonwebtoken";
import { injectable, inject } from "tsyringe";
import { UnitOfWork } from "../database/UnitOfWork";
import { LikeRepository } from "../repositories/like.repository";
import { FollowRepository } from "../repositories/follow.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { convertToObjectId } from "../utils/helpers";
import { NotificationService } from "./notification.service";
import { DTOService, PublicUserDTO, AdminUserDTO } from "./dto.service";
import { FeedService } from "./feed.service";

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
		@inject("FeedService") private readonly feedService: FeedService,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	/**
	 * Generates a JWT token for a user.
	 * @param user - The user object
	 * @returns A signed JWT token
	 */
	private generateToken(user: IUser): string {
		const payload = {
			id: user._id,
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
			const userDTO = this.dtoService.toPublicDTO(user);

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

			// Assign appropriate DTO
			const userDTO = user.isAdmin ? this.dtoService.toAdminDTO(user) : this.dtoService.toPublicDTO(user);

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
			const freshUser = await this.userRepository.findById(user.id as string);
			if (!freshUser) {
				throw createError("PathError", "User not found");
			}

			const token = this.generateToken(freshUser);
			return { user: this.dtoService.toPublicDTO(freshUser), token };
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
	 * Updates a user's profile information.
	 * @param id - The ID of the user being updated.
	 * @param userData - The new user data.
	 * @param requestingUser - The user making the request.
	 * @returns The updated user (DTO).
	 */

	async updateProfile(
		id: string,
		userData: { username?: string; bio?: string }, //Might extend
		requestingUser: IUser
	): Promise<PublicUserDTO | AdminUserDTO> {
		try {
			let updatedUser: IUser | null = null;
			const allowedUpdates: Partial<IUser> = {};
			if (userData.username !== undefined) {
				allowedUpdates.username = userData.username.trim();
			}

			if (userData.bio !== undefined) {
				allowedUpdates.bio = userData.bio.trim();
			}

			if (Object.keys(allowedUpdates).length === 0) {
				throw createError("ValidationError", "No valid fields provided for update.");
			}

			await this.unitOfWork.executeInTransaction(async (session) => {
				updatedUser = await this.userRepository.update(id, allowedUpdates);
				if (!updatedUser) {
					throw createError("NotFoundError", "User not found during update.");
				}
				await this.userActionRepository.logAction(id, "User data update", id, session);
			});

			if (!updatedUser) {
				throw createError("InternalServerError", "Profile update failed unexpectedly.");
			}

			return requestingUser?.isAdmin
				? this.dtoService.toAdminDTO(updatedUser)
				: this.dtoService.toPublicDTO(updatedUser);
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				console.error(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message
				);
			} else {
				console.error("Unknown error", error);
			}
			throw error instanceof Error ? error : createError("InternalServerError", "Failed to update profile.");
		}
	}

	/**
	 * Changes a user's password after verifying the current one.
	 * @param userId - The ID of the user being updated.
	 * @param currentPassword - The current password.
	 * @param newPassword - The new password.
	 * @returns Promise<void>.
	 */
	//TODO: Remember to refactor. This is sloppy
	async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
		// Doesn't need to return user data typically
		if (!currentPassword || !newPassword) {
			throw createError("ValidationError", "Current and new passwords are required.");
		}
		if (newPassword.length < 8) {
			throw createError("ValidationError", "New password must be at least 8 characters long.");
		}
		if (currentPassword === newPassword) {
			throw createError("ValidationError", "New password cannot be the same as the current password.");
		}

		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.userRepository.findById(userId, session, {
					selectPassword: true,
				});

				if (!user) {
					throw createError("NotFoundError", "User not found.");
				}
				if (!user.comparePassword) {
					throw createError("InternalServerError", "Password comparison method not available.");
				}

				// Verify current password
				const isMatch = await user.comparePassword(currentPassword);
				if (!isMatch) {
					throw createError("AuthenticationError", "Incorrect password.");
				}

				user.password = newPassword;
				await user.save({ session }); // Use Mongoose save() which triggers hooks

				await this.userActionRepository.logAction(userId, "Password changed", userId, session);
			});

			console.log(`Password changed successfully for user ${userId}`);
		} catch (error) {
			if (error instanceof Error) {
				console.error("[changePassword] Error:", error.name, error.message);
			} else {
				console.error("[changePassword] Error:", error);
			}

			throw error instanceof Error ? error : createError("InternalServerError", "Failed to change password.");
		}
	}

	/**
	 * Updates a user's avatar image.
	 * @param userId - The ID of the user updating their avatar.
	 * @param file - The new avatar image file.
	 */
	async updateAvatar(userId: string, file: Buffer): Promise<void> {
		let newAvatarUrl: string | null = null;
		let username: string | null = null;
		let oldAvatarUrl: string | null = null;

		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.userRepository.findById(userId, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}
				oldAvatarUrl = user.avatar;
				const newAvatar = await this.imageStorageService.uploadImage(file, user.id);
				newAvatarUrl = newAvatar.url;
				userId = user.id;
				await this.userRepository.updateAvatar(userId, newAvatar.url, session);
			});

			if (oldAvatarUrl) {
				const deleteResult = await this.imageStorageService.deleteAssetByUrl(userId, oldAvatarUrl);
				if (deleteResult.result !== "ok") {
					console.log(`Old avatar deletion not successful: ${oldAvatarUrl}, result: ${deleteResult.result}`);
				}
			}
		} catch (error) {
			// Clean up the only if the transaction or upload failed
			if (newAvatarUrl && !userId) {
				// username is set only if transaction succeeds
				try {
					await this.imageStorageService.deleteAssetByUrl(userId, newAvatarUrl);
				} catch (deleteError) {
					console.error("Failed to clean up new avatar:", deleteError);
				}
			}
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
	 * Updates a user's cover image.
	 * @param userId - The ID of the user updating their cover.
	 * @param file - The new cover image file.
	 */
	async updateCover(userId: string, file: Buffer): Promise<void> {
		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.userRepository.findById(userId, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}

				const oldCoverUrl = user.cover;
				const cloudImage = await this.imageStorageService.uploadImage(file, user.id);

				await this.userRepository.updateCover(userId, cloudImage.url, session);

				if (oldCoverUrl) {
					await this.imageStorageService.deleteAssetByUrl(userId, oldCoverUrl);
				}
			});
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
	 * Deletes a user from the system.
	 * @param id - The ID of the user to be deleted.
	 * @throws NotFoundError if the user is not found.
	 */
	async deleteUser(id: string): Promise<void> {
		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.userRepository.findById(id, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}

				if (user.images.length > 0) {
					const cloudResult = await this.imageStorageService.deleteMany(user.username);
					if (cloudResult.result !== "ok") {
						throw createError("CloudinaryError", cloudResult.message || "Error deleting cloudinary data");
					}
				}

				await this.imageRepository.deleteMany(id, session);
				await this.userRepository.delete(id, session);
			});
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

			// Return admin DTO if requesting user is admin
			if (requestingUser?.isAdmin) {
				return this.dtoService.toAdminDTO(user);
			}
			return this.dtoService.toPublicDTO(user);
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
	 * Handles user "like" or "unlike" actions on an image.
	 * If the user has already liked the image, it removes the like.
	 * Otherwise, it adds a like and triggers a notification.
	 * @param userId - The ID of the user performing the action.
	 * @param imageId - The ID of the image being liked/unliked.
	 * @throws PathError if the image is not found.
	 * @throws TransactionError if the database transaction fails.
	 */
	async likeAction(userId: string, imageId: string): Promise<IImage | null> {
		let isLikeAction = true; // Track if this is a like or unlike
		let imageTags: string[] = []; // Stroe image tags for the feed service

		try {
			// Check if image exists before starting transaction
			const existingImage = await this.imageRepository.findById(imageId);
			if (!existingImage) {
				throw createError("PathError", `Image with id ${imageId} not found`);
			}
			imageTags = existingImage.tags.map((tag) => tag.tag);

			await this.unitOfWork.executeInTransaction(async (session) => {
				const existingLike = await this.likeRepository.findByUserAndImage(userId, imageId, session);

				if (existingLike) {
					// Unlike flow
					isLikeAction = false;
					await this.likeRepository.deleteLike(userId, imageId, session);
					await this.imageRepository.findOneAndUpdate({ _id: imageId }, { $inc: { likes: -1 } }, session);
					await this.userActionRepository.logAction(userId, "unlike", imageId, session);
				} else {
					// Like flow
					const userIdObject = convertToObjectId(userId);
					const imageIdObject = convertToObjectId(imageId);

					await this.likeRepository.create({ userId: userIdObject, imageId: imageIdObject }, session);
					await this.imageRepository.findOneAndUpdate({ _id: imageId }, { $inc: { likes: 1 } }, session);

					await this.userActionRepository.logAction(userId, "like", imageId, session);
					await this.notificationService.createNotification({
						receiverId: existingImage.user.publicId.toString(),
						actionType: "like",
						actorId: userId,
						targetId: imageId,
						session,
					});
				}
			});

			// Updating feed preference, not awaiting this to not block the response
			this.feedService
				.recordInteraction(userId, isLikeAction ? "like" : "unlike", imageId, imageTags)
				.catch((error) => {
					// Log error but don't fail the request
					console.error("Failed to record feed interaction:", error);
				});

			//Return the updated image
			return this.imageRepository.findById(imageId);
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				if (error.name === "PathError") {
					throw createError("PathError", String(error.message));
				}
				throw createError("TransactionError", String(error.message), {
					function: "likeAction",
					additionalInfo: "Transaction failed",
					originalError: error,
				});
			}
			// If error is not handled above, return null to satisfy return type
			return null;
		}
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

	// === ADMIN METHODS ===

	/**
	 * Gets detailed statistics for a specific user
	 */
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

		return {
			user: this.dtoService.toAdminDTO(user),
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

	async deleteUserByPublicId(publicId: string): Promise<void> {
		const user = await this.userRepository.findByPublicId(publicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		await this.userRepository.delete(String(user._id).toString());
	}

	async banUserByPublicId(publicId: string, adminId: string, reason: string): Promise<any> {
		const user = await this.userRepository.findByPublicId(publicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const updatedUser = await this.userRepository.update(String(user._id), {
			isBanned: true,
			bannedAt: new Date(),
			bannedReason: reason,
			bannedBy: adminId,
		});

		return { message: "User banned successfully", user: this.dtoService.toAdminDTO(updatedUser!) };
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

		return this.dtoService.toAdminDTO(updatedUser);
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

	/**
	 * Gets recent activity across the platform
	 */
	async getRecentActivity(options: PaginationOptions) {
		const activities = await this.userActionRepository.findWithPagination({
			...options,
			sortBy: "timestamp",
			sortOrder: "desc",
		});

		return activities;
	}

	/**
	 * Promotes a user to admin
	 */
	async promoteToAdmin(userId: string) {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		if (user.isAdmin) {
			throw createError("ValidationError", "User is already an admin");
		}

		const updatedUser = await this.userRepository.update(userId, {
			isAdmin: true,
		});
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during promotion.");
		}
		return this.dtoService.toAdminDTO(updatedUser);
	}

	/**
	 * Demotes a user from admin
	 */
	async demoteFromAdmin(userId: string) {
		const user = await this.userRepository.findById(userId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		if (!user.isAdmin) {
			throw createError("ValidationError", "User is not an admin");
		}

		const updatedUser = await this.userRepository.update(userId, {
			isAdmin: false,
		});
		if (!updatedUser) {
			throw createError("InternalServerError", "Failed to update user during demotion.");
		}
		return this.dtoService.toAdminDTO(updatedUser);
	}

	// === SECURE PUBLIC ID METHODS ===

	/**
	 * Follows a user by their public ID
	 */
	async followUserByPublicId(followerId: string, targetPublicId: string): Promise<void> {
		try {
			const targetUser = await this.userRepository.findByPublicId(targetPublicId);
			if (!targetUser) {
				throw createError("NotFoundError", "User not found");
			}

			await this.followAction(followerId, (targetUser._id as string).toString());
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Unfollows a user by their public ID
	 */
	async unfollowUserByPublicId(followerId: string, targetPublicId: string): Promise<void> {
		try {
			const targetUser = await this.userRepository.findByPublicId(targetPublicId);
			if (!targetUser) {
				throw createError("NotFoundError", "User not found");
			}

			// Since followAction handles both follow/unfollow, we can reuse it
			await this.followAction(followerId, (targetUser._id as string).toString());
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Checks if current user is following another user by public ID
	 */
	async checkFollowStatusByPublicId(followerId: string, targetPublicId: string): Promise<{ isFollowing: boolean }> {
		try {
			const targetUser = await this.userRepository.findByPublicId(targetPublicId);
			if (!targetUser) {
				throw createError("NotFoundError", "User not found");
			}

			const isFollowing = await this.followRepository.isFollowing(followerId, (targetUser._id as string).toString());
			return { isFollowing };
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Likes an image by its public ID
	 */
	async likeImageByPublicId(userId: string, imagePublicId: string): Promise<IImage | null> {
		try {
			const image = await this.imageRepository.findByPublicId(imagePublicId);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}

			return await this.likeAction(userId, (image._id as string).toString());
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Unlikes an image by its public ID
	 */
	async unlikeImageByPublicId(userId: string, imagePublicId: string): Promise<IImage | null> {
		try {
			const image = await this.imageRepository.findByPublicId(imagePublicId);
			if (!image) {
				throw createError("NotFoundError", "Image not found");
			}

			// Since likeAction handles both like/unlike, we can reuse it
			return await this.likeAction(userId, (image._id as string).toString());
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Deletes the current user's account
	 */
	async deleteMyAccount(userId: string): Promise<void> {
		try {
			// Use the existing deleteUser method
			await this.deleteUser(userId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", errorMessage);
		}
	}
}
