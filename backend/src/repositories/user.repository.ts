import { Model, ClientSession } from "mongoose";
import { IUser, PaginationOptions, PaginationResult } from "../types";
import { createError } from "../utils/errors";
import { injectable, inject } from "tsyringe";
import { BaseRepository } from "./base.repository";

/**
 * UserRepository provides database access for user-related operations.
 * It extends BaseRepository and includes custom methods for user management.
 */
@injectable()
export class UserRepository extends BaseRepository<IUser> {
	constructor(@inject("UserModel") model: Model<IUser>) {
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
			if (typeof error === "object" && error !== null && "code" in error && (error as any).code === 11000) {
				const field = Object.keys((error as any).keyValue)[0];
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
			console.log("updateData in user repo:", updateData);
			const query = this.model.findOneAndUpdate(
				{ _id: id },
				{ $set: updateData },
				{
					new: true,
				}
			);
			if (session) query.session(session);
			const result = await query.exec();
			console.log("[UserRepository.update] Result:", result);
			return result;
		} catch (error) {
			if (typeof error === "object" && error !== null && "code" in error && (error as any).code === 11000) {
				const field = Object.keys((error as any).keyValue)[0];
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
	async findByPublicId(publicId: string): Promise<IUser | null> {
		return this.model.findOne({ publicId }).exec();
	}

	// Lightweight internal id lookup by publicId (projection only _id)
	async findInternalIdByPublicId(publicId: string): Promise<string | null> {
		const doc = await this.model.findOne({ publicId }).select("_id").lean().exec();
		return doc ? (doc as any)._id.toString() : null;
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
}
