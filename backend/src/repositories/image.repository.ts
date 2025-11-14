import mongoose, { Model, ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { IImage, PaginationOptions, PaginationResult } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class ImageRepository extends BaseRepository<IImage> {
	constructor(@inject("ImageModel") model: Model<IImage>) {
		super(model);
	}
	// TODO: REFACTOR AND REMOVE OLD METHODS

	/**
	 * Finds an image by its public ID and returns only its internal MongoDB _id.
	 * This is a lightweight, performant way to get an ID for relationship linking.
	 *
	 * @param {string} publicId - The public ID of the image.
	 * @returns {Promise<string | null>} - The internal _id as a string, or null if not found.
	 */
	async findInternalIdByPublicId(publicId: string): Promise<string | null> {
		try {
			if (!publicId || typeof publicId !== "string") {
				return null;
			}

			const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const hasDotOrSlash = publicId.includes(".") || publicId.includes("/");
			const filter = hasDotOrSlash
				? { publicId }
				: { publicId: { $regex: new RegExp(`^${escapeRegex(publicId)}(?:\\.(?:png|jpe?g|webp|gif))?$`, "i") } };
			const doc = await this.model.findOne(filter).select("_id").lean().exec();

			return doc ? (doc as any)._id.toString() : null;
		} catch (error) {
			console.error(`Error in findInternalIdByPublicId for publicId: ${publicId}`, error);
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Finds images uploaded by a specific user using their public ID with pagination support.
	 *
	 * @param {string} userPublicId - The public ID of the user.
	 * @param {PaginationOptions} options - Pagination options.
	 * @returns {Promise<PaginationResult<IImage>>} - Paginated result of user's images.
	 */
	async findByUserPublicId(userPublicId: string, options: PaginationOptions): Promise<PaginationResult<IImage>> {
		try {
			const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder };

			// First find the user by publicId to get their internal _id
			const userQuery = await this.model.db.collection("users").findOne({ publicId: userPublicId });
			if (!userQuery) {
				throw createError("NotFoundError", "User not found");
			}

			const userId = userQuery._id;

			// Separate find query using internal user _id
			const findQuery = this.model.find({ user: userId });

			// Separate count query
			const countQuery = this.model.countDocuments({ user: userId });

			const [data, total] = await Promise.all([
				findQuery
					.populate("user", "username avatar publicId")
					.populate("tags", "tag")
					.sort(sort)
					.skip(skip)
					.limit(limit)
					.exec(),
				countQuery.exec(),
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

	/**
	 * Finds an image by its ID and populates related fields.
	 *
	 * @param {string} id - The ID of the image.
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<IImage | null>} - The found image or null if not found.
	 */
	async findById(id: string, session?: ClientSession): Promise<IImage | null> {
		try {
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw createError("ValidationError", "Invalid image ID");
			}
			const query = this.model.findById(id).populate("user", "username avatar publicId").populate("tags", "tag");

			if (session) query.session(session);
			const result = await query.exec();
			console.log(result);
			return result;
		} catch (error) {
			if ((error as any).name === "ValidationError") {
				throw error;
			}
			throw createError("DatabaseError", (error as any).message);
		}
	}

	/**
	 * Finds images uploaded by a specific user with pagination support.
	 *
	 * @param {string} userId - The ID of the user.
	 * @param {PaginationOptions} options - Pagination options.
	 * @returns {Promise<PaginationResult<IImage>>} - Paginated result of user's images.
	 */
	async findByUserId(userId: string, options: PaginationOptions): Promise<PaginationResult<IImage>> {
		try {
			const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder };

			// Separate find query
			const findQuery = this.model.find({ user: userId });

			// Separate count query
			const countQuery = this.model.countDocuments({ user: userId });

			const [data, total] = await Promise.all([
				findQuery.populate("user", "username").populate("tags", "tag").sort(sort).skip(skip).limit(limit).exec(),
				countQuery.exec(),
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

	/**
	 * Deletes all images associated with a specific user.
	 * Supports MongoDB transactions if a session is provided.
	 *
	 * @param {string} userId - The ID of the user whose images will be deleted.
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<void>} - Resolves when deletion is complete.
	 */
	async deleteMany(userId: string, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.deleteMany({ user: userId });
			if (session) query.session(session);
			const result = await query.exec();
			console.log(`result from await query.exec() : ${result} `);
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}
}
