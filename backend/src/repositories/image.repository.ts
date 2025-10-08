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

				// Stage 4: Sort images
				{ $sort: sort },

				// Stage 5: Pagination (skip and limit)
				{ $skip: skip },
				{ $limit: limit },

				// Stage 6: Project the structure using public IDs
				{
					$project: {
						_id: 0, // Exclude MongoDB _id
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
	async getFeedForUserCore(
		followingIds: string[],
		favoriteTags: string[],
		limit: number,
		skip: number
	): Promise<PaginationResult<any>> {
		try {
			const followingIdsObj = followingIds.map((id) => new mongoose.Types.ObjectId(id));
			const hasPreferences = followingIds.length > 0 || favoriteTags.length > 0;

			const aggregationPipeline: any[] = [
				{
					$lookup: {
						from: "tags",
						localField: "tags",
						foreignField: "_id",
						as: "tagObjects",
					},
				},
				// Stage 2: Extract tag names
				{
					$addFields: {
						tagNames: {
							$map: {
								input: "$tagObjects",
								as: "tag",
								in: "$$tag.tag",
							},
						},
					},
				},
				// Stage 3: Determine personalization
				{
					$addFields: {
						isPersonalized: hasPreferences
							? {
									$or: [
										{ $in: ["$user", followingIdsObj] },
										{ $gt: [{ $size: { $setIntersection: ["$tagNames", favoriteTags] } }, 0] },
									],
							  }
							: false,
					},
				},
				// Stage 4: Sort
				{
					$sort: {
						isPersonalized: -1,
						createdAt: -1,
					},
				},
				// Stage 5: Pagination
				{ $skip: skip },
				{ $limit: limit },

				// Stage 6: Lookup user and get publicId
				{
					$lookup: {
						from: "users",
						localField: "user",
						foreignField: "_id",
						as: "userInfo",
					},
				},
				{ $unwind: "$userInfo" },

				// Stage 7: Project
				{
					$project: {
						_id: 0,
						publicId: 1,
						url: 1,
						createdAt: 1,
						likes: 1,
						commentsCount: 1,
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: {
								input: "$tagObjects",
								as: "tagObj",
								in: {
									tag: "$$tagObj.tag",
									publicId: "$$tagObj.publicId",
								},
							},
						},
						isPersonalized: 1,
					},
				},
			];

			const [results, total] = await Promise.all([
				this.model.aggregate(aggregationPipeline).exec(),
				this.model.countDocuments({}),
			]);

			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;

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
	 * Generates a ranked feed of images based on user preferences and image attributes.
	 * Ranks images by recency, popularity, and tag relevance.
	 */
	async getRankedFeed(favoriteTags: string[], limit: number, skip: number): Promise<PaginationResult<any>> {
		try {
			const hasPreferences = favoriteTags.length > 0;

			// Define weights for ranking
			const weights = {
				recency: 0.5,
				popularity: 0.3,
				tagMatch: 0.2,
			};

			const aggregationPipeline: any[] = [
				// Stage 1: Lookup tags
				{
					$lookup: {
						from: "tags",
						localField: "tags",
						foreignField: "_id",
						as: "tagObjects",
					},
				},
				// Stage 2: Extract tag names
				{
					$addFields: {
						tagNames: {
							$map: {
								input: "$tagObjects",
								as: "tag",
								in: "$$tag.tag",
							},
						},
					},
				},
				// Stage 3: Calculate scores
				{
					$addFields: {
						//Exponential decay favoring newer content
						recencyScore: {
							// basically: '1 / ( 1 + days_old)' - creates a decay favoring more recent content
							$divide: [
								1,
								{
									$add: [
										1,
										{
											$divide: [
												{ $subtract: [new Date(), "$createdAt"] },
												1000 * 60 * 60 * 24, // milliseconds in a day
											],
										},
									],
								},
							],
						},

						// Logarithmic to prevent super viral content from dominating completely
						// causes deminishing returns, going from 1 to 20 likes matters more than going from 10k to 20k
						// using natural logarithm with { $add: ["$likes", 1] } to avoid log(0)
						popularityScore: { $ln: { $add: ["$likes", 1] } },

						tagMatchScore: hasPreferences ? { $size: { $setIntersection: ["$tagNames", favoriteTags] } } : 0,
					},
				},
				// Stage 4: Calculate final rank score
				{
					$addFields: {
						rankScore: {
							$add: [
								{ $multiply: ["$recencyScore", weights.recency] },
								{ $multiply: ["$popularityScore", weights.popularity] },
								{ $multiply: ["$tagMatchScore", weights.tagMatch] },
							],
						},
					},
				},
				// Stage 5: Sort by rank score
				{ $sort: { rankScore: -1 } },
				// Stage 6: Pagination
				{ $skip: skip },
				{ $limit: limit },
				// Stage 7: Lookup user and get publicId
				{
					$lookup: {
						from: "users",
						localField: "user",
						foreignField: "_id",
						as: "userInfo",
					},
				},
				{ $unwind: "$userInfo" },
				// Stage 8: Project final shape
				{
					$project: {
						_id: 0,
						publicId: 1,
						url: 1,
						createdAt: 1,
						likes: 1,
						commentsCount: 1,
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: {
								input: "$tagObjects",
								as: "tagObj",
								in: {
									tag: "$$tagObj.tag",
									publicId: "$$tagObj.publicId",
								},
							},
						},
						rankScore: 1, // for debugging
					},
				},
			];

			const [results, total] = await Promise.all([
				this.model.aggregate(aggregationPipeline).exec(),
				this.model.countDocuments({}),
			]);

			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;

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
	 * Trending feed: rank by popularity and recency within an optional time window
	 */
	async getTrendingFeed(
		limit: number,
		skip: number,
		options?: {
			timeWindowDays?: number;
			minLikes?: number;
			weights?: { recency?: number; popularity?: number; comments?: number };
		}
	): Promise<PaginationResult<any>> {
		try {
			const timeWindowDays = options?.timeWindowDays ?? 14;
			const minLikes = options?.minLikes ?? 0;
			const weights = {
				recency: options?.weights?.recency ?? 0.4,
				popularity: options?.weights?.popularity ?? 0.5,
				comments: options?.weights?.comments ?? 0.1,
			};

			const sinceDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);

			const aggregationPipeline: any[] = [
				// Restrict to recent window and minimal likes
				{ $match: { createdAt: { $gte: sinceDate }, likes: { $gte: minLikes } } },
				{ $lookup: { from: "tags", localField: "tags", foreignField: "_id", as: "tagObjects" } },
				{ $lookup: { from: "users", localField: "user", foreignField: "_id", as: "userInfo" } },
				{ $unwind: "$userInfo" },
				// Scores
				{
					$addFields: {
						recencyScore: {
							$divide: [
								1,
								{
									$add: [1, { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60 * 24] }],
								},
							],
						},
						popularityScore: { $ln: { $add: ["$likes", 1] } },
						commentsScore: { $ln: { $add: ["$commentsCount", 1] } },
						trendScore: {
							$add: [
								{ $multiply: ["$recencyScore", weights.recency] },
								{ $multiply: ["$popularityScore", weights.popularity] },
								{ $multiply: ["$commentsScore", weights.comments] },
							],
						},
					},
				},
				{ $sort: { trendScore: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				{
					$project: {
						_id: 0,
						publicId: 1,
						url: 1,
						createdAt: 1,
						likes: 1,
						commentsCount: 1,
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: {
								input: "$tagObjects",
								as: "tagObj",
								in: { tag: "$$tagObj.tag", publicId: "$$tagObj.publicId" },
							},
						},
						trendScore: 1,
					},
				},
			];

			const [results, total] = await Promise.all([
				this.model.aggregate(aggregationPipeline).exec(),
				this.model.countDocuments({ createdAt: { $gte: sinceDate }, likes: { $gte: minLikes } }),
			]);

			// pagination
			const totalPages = Math.ceil(total / limit); // round up so partial pages count as full pages
			const currentPage = Math.floor(skip / limit) + 1; // when skip is 0, page should be 1

			return { data: results, total, page: currentPage, limit, totalPages };
		} catch (error: any) {
			console.error(error);
			throw createError("DatabaseError", error.message);
		}
	}

	/**
	 * New feed: sorted by recency only
	 */
	async getNewFeed(limit: number, skip: number): Promise<PaginationResult<any>> {
		try {
			const aggregationPipeline: any[] = [
				{ $lookup: { from: "tags", localField: "tags", foreignField: "_id", as: "tagObjects" } },
				{ $lookup: { from: "users", localField: "user", foreignField: "_id", as: "userInfo" } },
				{ $unwind: "$userInfo" },
				{ $sort: { createdAt: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				{
					$project: {
						_id: 0,
						publicId: 1,
						url: 1,
						createdAt: 1,
						likes: 1,
						commentsCount: 1,
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: {
								input: "$tagObjects",
								as: "tagObj",
								in: { tag: "$$tagObj.tag", publicId: "$$tagObj.publicId" },
							},
						},
					},
				},
			];

			const [results, total] = await Promise.all([
				this.model.aggregate(aggregationPipeline).exec(),
				this.model.countDocuments({}),
			]);

			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;

			return { data: results, total, page: currentPage, limit, totalPages };
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
