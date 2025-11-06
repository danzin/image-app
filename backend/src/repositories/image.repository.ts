import mongoose, { Model, ClientSession, SortOrder, PipelineStage } from "mongoose";
import { BaseRepository } from "./base.repository";
import { IImage, PaginationOptions, PaginationResult } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class ImageRepository extends BaseRepository<IImage> {
	constructor(@inject("ImageModel") model: Model<IImage>) {
		super(model);
	}

	/**
	 * Helkper method to load tag IDs for a list of tag names
	 * @private
	 */
	private async loadFavoriteTagIds(tagNames: string[]): Promise<mongoose.Types.ObjectId[]> {
		if (tagNames.length === 0) {
			return [];
		}

		const tagDocs = await this.model.db
			.collection("tags")
			.find({ tag: { $in: tagNames } })
			.project({ _id: 1 })
			.toArray();

		return tagDocs.map((doc: any) => new mongoose.Types.ObjectId(doc._id));
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

			// Allow flexible matching:
			// - If the provided publicId includes a dot or slash, assume it's exact (e.g., cloud publicId 'user/abc123' or local 'uuid.png')
			// - Otherwise, match either the exact ID or the ID with a common image extension (local storage uses 'uuid.png')
			const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const hasDotOrSlash = publicId.includes(".") || publicId.includes("/");
			const filter = hasDotOrSlash
				? { publicId }
				: { publicId: { $regex: new RegExp(`^${escapeRegex(publicId)}(?:\\.(?:png|jpe?g|webp|gif))?$`, "i") } };

			const query = this.model.findOne(filter).populate("user", "username avatar publicId").populate("tags", "tag");

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
			console.log(`Finding image by slug: ${slug}`);

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
			const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

			const aggregationPipeline = [
				// Stage 4: Sort images
				{ $sort: sort },

				// Stage 5: Pagination (skip and limit)
				{ $skip: skip },
				{ $limit: limit },
				// Stage 1: Lookup tags associated with each image
				{
					$lookup: {
						from: "tags",
						localField: "tags",
						foreignField: "_id",
						as: "tagObjects",
					},
				},

				// Stage 2: Lookup user information for the image uploader
				{
					$lookup: {
						from: "users",
						localField: "user",
						foreignField: "_id",
						as: "userInfo",
					},
				},

				// Stage 3: Unwind the user info array
				{ $unwind: "$userInfo" },

				// Stage 6: Project the structure using public IDs
				{
					$project: {
						_id: 0,
						publicId: 1,
						url: 1,
						slug: 1,
						title: 1,
						originalName: 1,
						createdAt: 1,
						likes: 1,
						commentsCount: 1,
						tags: {
							$map: {
								input: "$tagObjects",
								as: "tagObj",
								in: "$$tagObj.tag",
							},
						},
						user: {
							publicId: "$userInfo.publicId",
							username: "$userInfo.username",
							avatar: "$userInfo.avatar",
						},
					},
				},
			];

			// Build aggregation query
			const aggregationQuery = this.model.aggregate(aggregationPipeline);
			if (session) aggregationQuery.session(session);

			// Build count query
			const countQuery = this.model.countDocuments();
			if (session) countQuery.session(session);

			const [results, total] = await Promise.all([aggregationQuery.exec(), countQuery.exec()]);
			return {
				data: results,
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
}
