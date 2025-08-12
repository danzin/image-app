import mongoose, { Model, ClientSession, SortOrder } from "mongoose";
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
	 * Finds an image by its public ID and populates related fields.
	 *
	 * @param {string} publicId - The public ID of the image.
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<IImage | null>} - The found image or null if not found.
	 */
	async findByPublicId(publicId: string, session?: ClientSession): Promise<IImage | null> {
		try {
			if (!publicId || typeof publicId !== "string") {
				throw createError("ValidationError", "Invalid public ID");
			}

			const query = this.model
				.findOne({ publicId })
				.populate("user", "username avatar publicId")
				.populate("tags", "tag");

			if (session) query.session(session);
			const result = await query.exec();
			return result;
		} catch (error) {
			if ((error as any).name === "ValidationError") {
				throw error;
			}
			throw createError("DatabaseError", (error as any).message);
		}
	}

	/**
	 * Finds an image by its slug and populates related fields.
	 *
	 * @param {string} slug - The slug of the image.
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<IImage | null>} - The found image or null if not found.
	 */
	async findBySlug(slug: string, session?: ClientSession): Promise<IImage | null> {
		try {
			if (!slug || typeof slug !== "string") {
				throw createError("ValidationError", "Invalid slug");
			}

			const query = this.model.findOne({ slug }).populate("user", "username avatar publicId").populate("tags", "tag");

			if (session) query.session(session);
			const result = await query.exec();
			return result;
		} catch (error) {
			if ((error as any).name === "ValidationError") {
				throw error;
			}
			throw createError("DatabaseError", (error as any).message);
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
			const query = this.model.findById(id).populate("user", "username").populate("tags", "tag");

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
	 * Returns images with pagination support.
	 *
	 * @param {PaginationOptions} options - Pagination options (page, limit, sort order).
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<PaginationResult<IImage>>} - Paginated result of images.
	 */
	async findWithPagination(options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IImage>> {
		try {
			const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder };

			// Separate find query
			const findQuery = this.model.find();
			if (session) findQuery.session(session);

			// Separate count query
			const countQuery = this.model.countDocuments();
			if (session) countQuery.session(session);

			// Execute both queries with Promise.all
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
	 * Finds images that have specific tags, with pagination support.
	 *
	 * @param {string[]} tagIds - List of tag IDs to filter images.
	 * @param {PaginationOptions} [options] - Optional pagination and sorting options.
	 * @returns {Promise<PaginationResult<IImage>>} - Paginated result of images matching the tags.
	 */
	async findByTags(
		tagIds: string[],
		options?: {
			page?: number;
			limit?: number;
			sortBy?: string;
			sortOrder?: string;
		}
	): Promise<PaginationResult<IImage>> {
		try {
			const page = options?.page || 1;
			const limit = options?.limit || 20;
			const sortOrder = options?.sortOrder || "desc";
			const sortBy = options?.sortBy || "createdAt";

			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder as SortOrder };

			// Execute both queries concurrently for efficiency
			const [data, total] = await Promise.all([
				this.model
					.find({ tags: { $in: tagIds } })
					.populate("user", "username")
					.populate("tags", "tag")
					.sort(sort)
					.skip(skip)
					.limit(limit)
					.exec(),
				this.model.countDocuments({ tags: { $in: tagIds } }),
			]);

			return {
				data,
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			};
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message, {
				function: "findByTags",
				options: options,
			});
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

	/**
	 * Generates a personalized feed of images for a user based on their following list and favorite tags.
	 * Falls back to showing recent content if no personalized content is available.
	 *
	 * @param {string[]} followingIds - Array of user IDs that the current user follows.
	 * @param {string[]} favoriteTags - Array of tag names that the user has marked as favorites.
	 * @param {number} limit - The number of images to return per request (pagination).
	 * @param {number} skip - The number of images to skip (pagination offset).
	 * @returns {Promise<PaginationResult<IImage>>} - A promise resolving to a paginated result containing images.
	 * @throws {Error} - Throws a 'DatabaseError' if the aggregation query fails.
	 */
	async getFeedForUser(
		followingIds: string[],
		favoriteTags: string[],
		limit: number,
		skip: number
	): Promise<PaginationResult<IImage>> {
		try {
			// Convert user IDs to MongoDB ObjectId format for querying
			const followingIdsObj = followingIds.map((id) => new mongoose.Types.ObjectId(id));

			// Determine if the user has any preferences (following users or favorite tags)
			const hasPreferences = followingIds.length > 0 || favoriteTags.length > 0;

			// Aggregation pipeline for generating the user feed
			// Personalized content is prioritized; when unavailable, it falls back to recent images
			const [results, total] = await Promise.all([
				this.model
					.aggregate([
						// Stage 1: Lookup tags associated with each image
						{
							$lookup: {
								from: "tags", // Join with the 'tags' collection
								localField: "tags", // Image document's 'tags' field
								foreignField: "_id", // Match with '_id' field in 'tags' collection
								as: "tagObjects", // Output array of matching tag documents
							},
						},

						// Stage 2: Extract tag names into a separate field for easier filtering
						{
							$addFields: {
								tagNames: {
									$map: {
										input: "$tagObjects",
										as: "tag",
										in: "$$tag.tag", // Extract the 'tag' field from each tag document
									},
								},
							},
						},

						// Stage 3: Determine whether an image matches the user's preferences
						{
							$addFields: {
								isPersonalized: hasPreferences
									? {
											$or: [
												{ $in: ["$user", followingIdsObj] }, // Image posted by a followed user
												{ $gt: [{ $size: { $setIntersection: ["$tagNames", favoriteTags] } }, 0] }, // Image contains a favorite tag
											],
									  }
									: false,
							},
						},

						// Stage 4: Sort images, prioritizing personalized content and then recency
						{
							$sort: {
								isPersonalized: -1, // Show personalized content first
								createdAt: -1, // Sort by newest images when personalization is equal
							},
						},

						// Stage 5: Pagination (skip and limit)
						{ $skip: skip },
						{ $limit: limit },

						// Stage 6: Lookup user information for the image uploader
						{
							$lookup: {
								from: "users", // Join with the 'users' collection
								localField: "user", // Match the 'user' field from images
								foreignField: "_id", // Match with '_id' field in 'users' collection
								as: "userInfo", // Output array of matching user documents
							},
						},

						// Stage 7: Unwind the user info array (since lookup returns an array)
						{ $unwind: "$userInfo" },

						// Stage 8: Project the final structure of the returned images
						{
							$project: {
								_id: 0, // Exclude the default '_id' field
								id: "$_id", // Rename '_id' to 'id' for consistency
								url: 1, // Image URL
								publicId: 1, // Public identifier
								createdAt: 1, // Image creation timestamp
								likes: 1, // Number of likes
								tags: {
									// Transform tags to match the format returned by other endpoints
									$map: {
										input: "$tagObjects",
										as: "tagObj",
										in: {
											tag: "$$tagObj.tag", // Extract tag name
											id: "$$tagObj._id", // Extract tag ID
										},
									},
								},
								user: {
									// Extract relevant user information
									id: "$userInfo._id",
									username: "$userInfo.username",
									avatar: "$userInfo.avatar",
								},
								isPersonalized: 1, // Keep for debugging (optional)
							},
						},
					])
					.exec(),

				// Count total number of available images in the database
				this.model.countDocuments({}),
			]);

			// Calculate pagination details
			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;

			// Return the paginated feed data
			return {
				data: results,
				total,
				page: currentPage,
				limit,
				totalPages,
			};
		} catch (error: any) {
			console.error(error);
			throw createError("DatabaseError", error.message);
		}
	}

	/**
	 * Increment or decrement comment count for an image
	 */
	async updateCommentCount(imageId: string, increment: number, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findByIdAndUpdate(imageId, { $inc: { commentsCount: increment } }, { session });
			await query.exec();
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}
}
