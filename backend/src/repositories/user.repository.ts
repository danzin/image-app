import { Model, ClientSession, Types } from "mongoose";
import { IUser, PaginationOptions, PaginationResult } from "../types";
import { createError, isMongoDBDuplicateKeyError } from "../utils/errors";
import { injectable, inject } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { FollowRepository } from "./follow.repository";
import { logger } from "../utils/winston";

/**
 * UserRepository provides database access for user-related operations.
 * It extends BaseRepository and includes custom methods for user management.
 */
@injectable()
export class UserRepository extends BaseRepository<IUser> {
	constructor(
		@inject("UserModel") model: Model<IUser>,
		@inject("FollowRepository") private readonly followRepository: FollowRepository
	) {
		super(model);
	}

	// TODO: REFACTOR AND REMOVE OLD METHODS

	/**
	 * Creates a new user in the database, handling duplicate key errors.
	 * @param userData - Partial user data to create a new user.
	 * @param session - (Optional) Mongoose session for transactions.
	 * @returns The created user object.
	 */
	async create(userData: Partial<IUser>, session?: ClientSession): Promise<IUser> {
		try {
			const doc = new this.model(userData);
			if (session) doc.$session(session);
			return await doc.save();
			//TODO: make sure catch blocks use custom error integrating the context
		} catch (error) {
			if (isMongoDBDuplicateKeyError(error)) {
				const field = Object.keys(error.keyValue)[0];
				throw createError("DuplicateError", `${field} already exists`, {
					function: "create",
					context: "userRepository",
				});
			}
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Updates a user's data based on a given user ID.
	 * Supports flexible updates with MongoDB operators (e.g., `$set`, `$addToSet`).
	 * @param id - User ID to update.
	 * @param updateData - Update operations.
	 * @param session - (Optional) Mongoose session for transactions.
	 * @returns The updated user object or null if not found.
	 */
	async update(id: string, updateData: any, session?: ClientSession): Promise<IUser | null> {
		try {
			logger.info("updateData in user repo:", updateData);

			const query = this.model.findOneAndUpdate({ _id: id }, updateData, { new: true });

			if (session) query.session(session);
			const result = await query.exec();
			logger.info("[UserRepository.update] Result:", result);
			return result;
		} catch (error) {
			if (isMongoDBDuplicateKeyError(error)) {
				const field = Object.keys(error.keyValue)[0];
				throw createError("DuplicateError", `${field} already exists`, {
					function: "create",
					context: "userRepository",
				});
			}
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Retrieves a paginated list of users with optional search functionality.
	 * @param {Object} options - The filtering and pagination options.
	 * @param {string[]} [options.search] - An array of search terms for filtering users by username.
	 * @param {number} [options.page=1] - The page number for pagination (default: 1).
	 * @param {number} [options.limit=20] - The maximum number of users per page (default: 20).
	 * @returns {Promise<IUser[] | null>} - A promise that resolves to an array of users or null if no users match.
	 * @throws {Error} - Throws a 'DatabaseError' if the query fails.
	 */
	async getAll(options: { search?: string[]; page?: number; limit?: number }): Promise<IUser[] | null> {
		try {
			const query: any = {};

			if (options.search && options.search.length > 0) {
				query.$or = options.search.map((term: string) => {
					return { username: { $regex: term, $options: "i" } };
				});
			}

			const page = options?.page || 1;
			const limit = options?.limit || 20;
			const skip = (page - 1) * limit;

			const result = await this.model.find(query).skip(skip).limit(limit).exec();
			if (!result || result.length === 0) {
				return null;
			}

			return result;
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message, {
				function: "getAll",
				options: options,
			});
		}
	}

	// Find user by public id
	async findByPublicId(publicId: string, session?: ClientSession): Promise<IUser | null> {
		if (session) {
			return this.model.findOne({ publicId }).session(session).exec();
		}
		return this.model.findOne({ publicId }).exec();
	}

	//find by query
	find(query: any) {
		return this.model.find(query);
	}

	// Lightweight internal id lookup by publicId (projection only _id)
	async findInternalIdByPublicId(publicId: string): Promise<string | null> {
		const doc = await this.model.findOne({ publicId }).select("_id").lean<{ _id: Types.ObjectId }>().exec();
		return doc ? doc._id.toString() : null;
	}

	/**
	 * Finds a user by username.
	 * @param username - The username to search for.
	 * @param session - (Optional) Mongoose session for transactions.
	 * @returns The user object or null if not found.
	 */
	async findByUsername(username: string, session?: ClientSession): Promise<IUser | null> {
		try {
			const query = this.model.findOne({ username }).select("+password");
			if (session) query.session(session);
			return await query.exec();
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Finds a user by email.
	 * @param email - The email to search for.
	 * @param session - (Optional) Mongoose session for transactions.
	 * @returns The user object or null if not found.
	 */
	async findByEmail(email: string, session?: ClientSession): Promise<IUser | null> {
		try {
			const query = this.model.findOne({ email }).select("+password");
			if (session) query.session(session);
			return await query.exec();
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	async findByResetToken(token: string, session?: ClientSession): Promise<IUser | null> {
		try {
			const query = this.model
				.findOne({ resetToken: token, resetTokenExpires: { $gt: new Date() } })
				.select("+password +resetToken +resetTokenExpires");
			if (session) query.session(session);
			return await query.exec();
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Retrieves paginated users from the database.
	 * @param options - Pagination options (page, limit, sorting).
	 * @returns A paginated result containing users.
	 */
	async findWithPagination(options: PaginationOptions): Promise<PaginationResult<IUser>> {
		try {
			const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder };

			const [data, total] = await Promise.all([
				this.model.find().sort(sort).skip(skip).limit(limit).exec(),
				this.model.countDocuments(),
			]);

			return {
				data,
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			};
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	// Profile-specific updates

	/**
	 * Updates the avatar URL of a user in the database.
	 * @param {string} userId - The unique identifier of the user.
	 * @param {string} avatarUrl - The new avatar URL to be set.
	 * @param {ClientSession} [session] - Optional Mongoose session for transaction support.
	 * @returns {Promise<void>} - Resolves when the update is complete.
	 * @throws {Error} - Throws a 'DatabaseError' if the update operation fails.
	 */
	async updateAvatar(userId: string, avatarUrl: string, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findByIdAndUpdate(userId, {
				$set: { avatar: avatarUrl },
			});
			if (session) query.session(session);
			await query.exec();
		} catch (error) {
			console.error(error);
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Updates the cover image URL of a user in the database.
	 * @param {string} userId - The unique identifier of the user.
	 * @param {string} coverUrl - The new cover image URL to be set.
	 * @param {ClientSession} [session] - Optional Mongoose session for transaction support.
	 * @returns {Promise<void>} - Resolves when the update is complete.
	 * @throws {Error} - Throws a 'DatabaseError' if the update operation fails.
	 */
	async updateCover(userId: string, coverUrl: string, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findByIdAndUpdate(userId, {
				$set: { cover: coverUrl },
			});
			if (session) query.session(session);
			await query.exec();
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	async findUsersFollowing(userPublicId: string): Promise<IUser[]> {
		try {
			const user = await this.model.findOne({ publicId: userPublicId }).select("_id").lean();
			if (!user?._id) {
				return [];
			}
			const userId = new Types.ObjectId(user._id.toString());
			const followerIds = await this.followRepository.getFollowerObjectIds(userId);

			if (followerIds.length === 0) {
				return [];
			}

			// Use the existing findUsersByIds method to avoid code duplication
			return await this.findUsersByIds(followerIds);
		} catch (error) {
			console.error(`Error finding followers for user ${userPublicId}:`, error);
			return [];
		}
	}

	async findUsersByPublicIds(userPublicIds: string[]): Promise<IUser[]> {
		try {
			return await this.model
				.find({
					publicId: { $in: userPublicIds },
				})
				.select("publicId username avatar")
				.exec();
		} catch (error) {
			console.error("Error in findUsersByPublicIds:", error);
			return [];
		}
	}

	async findUsersByIds(ids: string[]): Promise<IUser[]> {
		try {
			const objectIds = ids
				.map((id) => {
					try {
						return new Types.ObjectId(id);
					} catch {
						return null;
					}
				})
				.filter((id): id is Types.ObjectId => id !== null);

			if (objectIds.length === 0) {
				return [];
			}

			return await this.model
				.find({
					_id: { $in: objectIds },
				})
				.select("publicId username avatar bio")
				.exec();
		} catch (error) {
			console.error("Error in findUsersByIds:", error);
			return [];
		}
	}

	async findUsersByUsernames(usernames: string[]): Promise<IUser[]> {
		try {
			const regexes = usernames.map((u) => new RegExp(`^${u}$`, "i"));
			return await this.model
				.find({
					username: { $in: regexes },
				})
				.select("publicId username avatar")
				.exec();
		} catch (error) {
			console.error("Error in findUsersByUsernames:", error);
			return [];
		}
	}

	/**
	 * Get suggested users to follow based on engagement metrics
	 * Scores users based on: follower count (40%), total post likes (30%), post count (20%), recent activity (10%)
	 * @param currentUserId - ID of the current user (to exclude from suggestions)
	 * @param limit - Maximum number of suggestions to return
	 */
	async getSuggestedUsersToFollow(currentUserId: string, limit: number = 5): Promise<any[]> {
		try {
			const thirtyDaysAgo = new Date();
			thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

			const followingIds = (await this.followRepository.getFollowingObjectIds(currentUserId))
				.map((id) => {
					try {
						return new Types.ObjectId(id);
					} catch {
						return null;
					}
				})
				.filter((value): value is Types.ObjectId => value instanceof Types.ObjectId);

			const result = await this.model.aggregate([
				// exclude the current user, users they already follow, and banned users
				{
					$match: {
						_id: { $ne: new Types.ObjectId(currentUserId), $nin: followingIds },
						isBanned: false,
					},
				},
				{
					$lookup: {
						from: "follows",
						localField: "_id",
						foreignField: "followeeId",
						as: "followerLinks",
					},
				},
				// lookup posts for each user
				{
					$lookup: {
						from: "posts",
						localField: "_id",
						foreignField: "user",
						as: "posts",
					},
				},
				// calculate metrics
				{
					$addFields: {
						followerCount: { $size: "$followerLinks" },
						postCount: { $size: "$posts" },
						totalLikes: {
							$reduce: {
								input: "$posts",
								initialValue: 0,
								in: {
									$add: [
										"$$value",
										{
											$cond: [
												{ $isArray: "$$this.likes" },
												{ $size: { $ifNull: ["$$this.likes", []] } },
												{ $ifNull: ["$$this.likesCount", 0] },
											],
										},
									],
								},
							},
						},
						recentPostCount: {
							$size: {
								$filter: {
									input: "$posts",
									as: "post",
									cond: { $gte: ["$$post.createdAt", thirtyDaysAgo] },
								},
							},
						},
					},
				},
				// filter users with at least some activity
				{
					$match: {
						$or: [{ followerCount: { $gte: 1 } }, { postCount: { $gte: 1 } }, { totalLikes: { $gte: 1 } }],
					},
				},
				// calculate engagement score
				{
					$addFields: {
						score: {
							$add: [
								{ $multiply: ["$followerCount", 0.4] },
								{ $multiply: ["$totalLikes", 0.3] },
								{ $multiply: ["$postCount", 0.2] },
								{ $multiply: ["$recentPostCount", 0.1] },
							],
						},
					},
				},
				// sort by score descending
				{ $sort: { score: -1 } },
				// limit results
				{ $limit: limit },
				// project only needed fields
				{
					$project: {
						publicId: 1,
						username: 1,
						avatar: 1,
						bio: 1,
						followerCount: 1,
						postCount: 1,
						totalLikes: 1,
						score: 1,
					},
				},
			]);

			return result;
		} catch (error) {
			console.error("Error in getSuggestedUsersToFollow:", error);
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	async updateFollowerCount(userId: string, increment: number, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findByIdAndUpdate(userId, { $inc: { followerCount: increment } }, { session });
			await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to update follower count");
		}
	}

	async updateFollowingCount(userId: string, increment: number, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findByIdAndUpdate(userId, { $inc: { followingCount: increment } }, { session });
			await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to update following count");
		}
	}
}
