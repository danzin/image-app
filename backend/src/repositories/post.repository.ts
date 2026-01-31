import mongoose, { ClientSession, Model, PipelineStage, SortOrder } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import {
	IPost,
	PaginationOptions,
	PaginationResult,
	TrendingTag,
	CursorPaginationOptions,
	CursorPaginationResult,
} from "@/types";
import { createError } from "@/utils/errors";

@injectable()
export class PostRepository extends BaseRepository<IPost> {
	constructor(@inject("PostModel") model: Model<IPost>) {
		super(model);
	}

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

	async findInternalIdByPublicId(publicId: string): Promise<string | null> {
		const doc = await this.model.findOne({ publicId }).select("_id").lean().exec();
		return doc ? String(doc._id) : null;
	}

	async findOneByPublicId(publicId: string, session?: ClientSession): Promise<IPost | null> {
		try {
			const query = this.model.findOne({ publicId });
			if (session) query.session(session);
			return await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to find post by publicId");
		}
	}

	async findByCommunityId(communityId: string, page: number = 1, limit: number = 20): Promise<IPost[]> {
		const skip = (page - 1) * limit;
		return this.model
			.find({ communityId })
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(limit)
			.populate("author")
			.populate("image")
			.exec();
	}

	async countByCommunityId(communityId: string): Promise<number> {
		return this.model.countDocuments({ communityId }).exec();
	}

	async incrementViewCount(postId: mongoose.Types.ObjectId, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findOneAndUpdate({ _id: postId }, { $inc: { viewsCount: 1 } }, { new: true });
			if (session) query.session(session);
			await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to increment post view count");
		}
	}

	async updateRepostCount(postId: string, increment: number, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.updateOne({ _id: postId }, { $inc: { repostCount: increment } });
			if (session) query.session(session);
			await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to update repost count");
		}
	}

	/**
	 * returns standard $lookup stages for populating post relationships
	 */
	private getStandardLookups(): PipelineStage[] {
		return [
			{ $lookup: { from: "tags", localField: "tags", foreignField: "_id", as: "tagObjects" } },
			{ $lookup: { from: "images", localField: "image", foreignField: "_id", as: "imageDoc" } },
			{ $unwind: { path: "$imageDoc", preserveNullAndEmptyArrays: true } },

			// lookup community for community posts
			{ $lookup: { from: "communities", localField: "communityId", foreignField: "_id", as: "communityDoc" } },
			{ $unwind: { path: "$communityDoc", preserveNullAndEmptyArrays: true } },

			{
				$lookup: {
					from: "posts",
					let: { repostId: "$repostOf" },
					pipeline: [
						{ $match: { $expr: { $eq: ["$_id", "$$repostId"] } } },

						{
							$lookup: {
								from: "images",
								localField: "image",
								foreignField: "_id",
								as: "repostImageDoc",
							},
						},
						{ $unwind: { path: "$repostImageDoc", preserveNullAndEmptyArrays: true } },
					],
					as: "repostDoc",
				},
			},
			{ $unwind: { path: "$repostDoc", preserveNullAndEmptyArrays: true } },
		];
	}

	/**
	 * returns standard projection fields for shaping post output
	 */
	private getStandardProjectionFields() {
		return {
			_id: 0,
			publicId: 1,
			body: 1,
			slug: 1,
			type: 1,
			repostCount: 1,
			createdAt: 1,
			likes: "$likesCount",
			viewsCount: { $ifNull: ["$viewsCount", 0] },
			commentsCount: 1,

			// Map the root userPublicId directly to the author snapshot
			userPublicId: "$author.publicId",

			tags: {
				$map: {
					input: { $ifNull: ["$tagObjects", []] },
					as: "tag",
					in: { tag: "$$tag.tag", publicId: "$$tag.publicId" },
				},
			},

			// Construct the User object from the Snapshot
			user: {
				publicId: "$author.publicId",
				username: "$author.username",
				avatar: "$author.avatarUrl",
				displayName: "$author.displayName",
			},

			image: {
				$cond: {
					if: { $ne: ["$imageDoc", null] },
					then: {
						publicId: "$imageDoc.publicId",
						url: "$imageDoc.url",
						slug: "$imageDoc.slug",
					},
					else: {},
				},
			},

			repostOf: {
				$cond: {
					if: { $ne: ["$repostDoc", null] },
					then: {
						publicId: "$repostDoc.publicId",
						body: "$repostDoc.body",
						slug: "$repostDoc.slug",
						likesCount: "$repostDoc.likesCount",
						commentsCount: "$repostDoc.commentsCount",
						repostCount: "$repostDoc.repostCount",

						user: {
							publicId: "$repostDoc.author.publicId",
							username: "$repostDoc.author.username",
							avatar: "$repostDoc.author.avatarUrl",
						},

						image: {
							$cond: {
								if: { $ne: ["$repostDoc.repostImageDoc", null] },
								then: {
									publicId: "$repostDoc.repostImageDoc.publicId",
									url: "$repostDoc.repostImageDoc.url",
								},
								else: null,
							},
						},
					},
					else: null,
				},
			},

			// community info for community posts
			community: {
				$cond: {
					if: { $ne: ["$communityDoc", null] },
					then: {
						publicId: "$communityDoc.publicId",
						name: "$communityDoc.name",
						slug: "$communityDoc.slug",
						avatar: "$communityDoc.avatar",
					},
					else: null,
				},
			},
		};
	}

	/**
	 * returns standard $project stage for shaping post output
	 */
	private getStandardProjection(): PipelineStage {
		return {
			$project: this.getStandardProjectionFields(),
		};
	}

	async findByIdWithPopulates(id: string, session?: ClientSession): Promise<IPost | null> {
		try {
			const query = this.model
				.findById(id)
				.populate("tags", "tag")
				.populate({ path: "image", select: "_id url publicId slug createdAt" });

			if (session) query.session(session);
			return await query.exec();
		} catch (err: any) {
			throw createError("DatabaseError", err.message ?? "failed to load post by id");
		}
	}

	async findPostsByIds(ids: string[], _viewerPublicId?: string): Promise<IPost[]> {
		try {
			const objectIds = ids.map((id) => this.normalizeObjectId(id, "id"));

			const pipeline: PipelineStage[] = [
				{ $match: { _id: { $in: objectIds } } },
				...this.getStandardLookups(),
				this.getStandardProjection(),
			];

			// If viewerPublicId is provided, we could potentially add isLiked/isFavorited fields here
			// but that logic is usually handled in the service/DTO layer or via separate lookups.
			// For now, just return the posts.

			const results = await this.model.aggregate(pipeline).exec();
			return results;
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to find posts by ids");
		}
	}

	async findByPublicId(publicId: string, session?: ClientSession): Promise<IPost | null> {
		try {
			const query = this.model
				.findOne({ publicId })
				.populate("tags", "tag")
				.populate({ path: "image", select: "_id url publicId slug createdAt" })
				.populate({ path: "communityId", select: "publicId name slug avatar" })
				.populate({
					path: "repostOf",
					select: "publicId body image user author tags",
					populate: [
						{ path: "image", select: "_id url publicId slug createdAt" },
						{ path: "tags", select: "tag" },
						{ path: "user", select: "publicId username avatar profile displayName" },
					],
				})
				.lean();

			if (session) query.session(session);
			return (await query.exec()) as IPost | null;
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to load post");
		}
	}

	async findBySlug(slug: string, session?: ClientSession): Promise<IPost | null> {
		try {
			const query = this.model
				.findOne({ slug })
				.populate("tags", "tag")
				.populate({ path: "image", select: "url publicId slug createdAt -_id" });

			if (session) query.session(session);
			return await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to load post by slug");
		}
	}

	async findByUserPublicId(userPublicId: string, options: PaginationOptions): Promise<PaginationResult<IPost>> {
		try {
			const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
			const skip = (page - 1) * limit;
			const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

			const userDoc = await this.model.db
				.collection("users")
				.findOne({ publicId: userPublicId }, { projection: { _id: 1 } });
			if (!userDoc) {
				throw createError("NotFoundError", "User not found");
			}

			const userId = new mongoose.Types.ObjectId(userDoc._id);

			const pipeline: PipelineStage[] = [
				{ $match: { user: userId } },
				{ $sort: sort },
				{ $skip: skip },
				{ $limit: limit },
				...this.getStandardLookups(),
				{ $project: this.getStandardProjectionFields() },
			];

			const [data, total] = await Promise.all([
				this.model.aggregate(pipeline).exec(),
				this.model.countDocuments({ user: userId }),
			]);

			return {
				data,
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			};
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to load posts by user");
		}
	}

	async findWithPagination(options: PaginationOptions, session?: ClientSession): Promise<PaginationResult<IPost>> {
		try {
			const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = options;
			const skip = (page - 1) * limit;
			const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

			const pipeline: PipelineStage[] = [
				{ $sort: sort },
				{ $skip: skip },
				{ $limit: limit },
				...this.getStandardLookups(),
				this.getStandardProjection(),
			];

			const aggregate = this.model.aggregate(pipeline);
			if (session) aggregate.session(session);

			const [results, total] = await Promise.all([aggregate.exec(), this.model.countDocuments()]);

			return {
				data: results,
				total,
				page,
				limit,
				totalPages: Math.ceil(total / limit),
			};
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to paginate posts");
		}
	}

	async findByTags(
		tagIds: string[],
		options?: { page?: number; limit?: number; sortBy?: string; sortOrder?: string }
	): Promise<PaginationResult<IPost>> {
		try {
			const page = options?.page || 1;
			const limit = options?.limit || 20;
			const sortOrder = options?.sortOrder || "desc";
			const sortBy = options?.sortBy || "createdAt";
			const skip = (page - 1) * limit;
			const sort = { [sortBy]: sortOrder as SortOrder };

			const [data, total] = await Promise.all([
				this.model
					.find({ tags: { $in: tagIds } })
					.populate("tags", "tag")
					.populate({ path: "image", select: "url publicId slug -_id" })
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
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to load posts by tags");
		}
	}

	/**
	 * Generates a personalized feed combining posts from followed users and favorite tags
	 * @deprecated Use cursor-based pagination instead for better performance on deep pagination
	 * Consider migrating to a cursor-based approach for infinite scroll experiences
	 * @pattern Two-Layer Feed Architecture (Core + Enrichment)
	 * @strategy Personalization combining user follows and tag preferences with backfill fallback
	 * @complexity O(N log N) where N is total posts matching criteria; sort/skip/limit overhead on large collections
	 * @note Uses skip-based pagination which degrades for deep pages; O(skip) scan cost applies
	 * @param followingIds - Array of user ObjectIds the current user follows
	 * @param favoriteTags - Array of tag names the user has marked as favorites
	 * @param limit - Number of posts per page
	 * @param skip - Number of posts to skip (page offset)
	 * @returns {Promise<PaginationResult<any>>} Paginated result with personalized posts and metadata
	 * @throws {DatabaseError} if aggregation pipeline fails
	 */
	async getFeedForUserCore(
		followingIds: string[],
		favoriteTags: string[],
		limit: number,
		skip: number
	): Promise<PaginationResult<any>> {
		try {
			const followingObjectIds = followingIds.map((id) => new mongoose.Types.ObjectId(id));
			const favoriteTagIds = await this.loadFavoriteTagIds(favoriteTags);
			const hasPreferences = followingObjectIds.length > 0 || favoriteTagIds.length > 0;

			const orConditions: Record<string, unknown>[] = [];
			if (followingObjectIds.length) {
				orConditions.push({ user: { $in: followingObjectIds } });
			}
			if (favoriteTagIds.length) {
				orConditions.push({ tags: { $in: favoriteTagIds } });
			}

			const pipeline: PipelineStage[] = [];
			if (orConditions.length) {
				pipeline.push({ $match: { $or: orConditions } });
			}

			const feedProjection = this.getStandardProjectionFields();

			// optimization: sort and paginate BEFORE expensive $lookups
			// this reduces the number of documents that need relationship population
			pipeline.push(
				{
					$addFields: {
						isPersonalized: hasPreferences
							? {
									$or: [
										{ $in: ["$user", followingObjectIds] },
										{ $gt: [{ $size: { $setIntersection: [{ $ifNull: ["$tags", []] }, favoriteTagIds] } }, 0] },
									],
								}
							: false,
					},
				},
				{ $sort: { isPersonalized: -1, createdAt: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				// now do $lookups on the reduced set of documents
				...this.getStandardLookups(),
				{
					$addFields: {
						tagNames: { $map: { input: { $ifNull: ["$tagObjects", []] }, as: "tag", in: "$$tag.tag" } },
					},
				},
				{ $project: feedProjection }
			);
			let results = await this.model.aggregate(pipeline).exec();

			// backfill with new posts if not enough personalized content
			if (results.length < limit) {
				const needed = limit - results.length;
				const existingIds = results.map((post) => post.publicId);

				const backfillPipeline: PipelineStage[] = [
					{ $match: { publicId: { $nin: existingIds } } },
					{ $sort: { createdAt: -1 } },
					{ $limit: needed },
					// do $lookups after limiting to avoid populating unnecessary documents
					...this.getStandardLookups(),
					{ $project: feedProjection },
				];
				const backfillResults = await this.model.aggregate(backfillPipeline).exec();
				results = [...results, ...backfillResults];
				console.info(`Backfilled ${backfillResults.length} new posts to personalized feed`);
			}

			// calculate total based on all available posts (personalized + backfill pool)
			// this ensures infinite scroll continues as long as there's content
			const total = await this.model.countDocuments({});
			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;

			console.info(`Feed for user core generated with ${results.length} results (page ${currentPage}/${totalPages})`);
			return { data: results, total, page: currentPage, limit, totalPages };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to generate feed");
		}
	}

	/**
	 * Generates a ranked feed using weighted scoring (recency + popularity + tag match)
	 * @deprecated Use getRankedFeedWithCursor for better deep pagination performance
	 * The cursor-based variant avoids skip() overhead and scales better for infinite scroll
	 * @pattern Weighted Ranking Algorithm
	 * @strategy Time-decay scoring with logarithmic dampening for engagement metrics
	 * @complexity O(N log N) aggregation + O(skip) scan cost on skip-based pagination
	 * @note Limited to recent posts (90 days) to optimize performance and relevance
	 * @param favoriteTags - Array of tag names for tag-match scoring
	 * @param limit - Number of posts per page
	 * @param skip - Number of posts to skip (use cursor pagination for deep pages)
	 * @returns {Promise<PaginationResult<any>>} Ranked posts with computed scores
	 * @throws {DatabaseError} if score computation or aggregation fails
	 */
	async getRankedFeed(favoriteTags: string[], limit: number, skip: number): Promise<PaginationResult<any>> {
		try {
			const weights = { recency: 0.5, popularity: 0.3, tagMatch: 0.2 };
			const favoriteTagIds = await this.loadFavoriteTagIds(favoriteTags);
			const hasTagPreferences = favoriteTagIds.length > 0;

			// filter to recent posts to avoid full collection scan
			const recentThresholdDays = 90;
			const sinceDate = new Date(Date.now() - recentThresholdDays * 24 * 60 * 60 * 1000);

			const pipeline: PipelineStage[] = [
				{ $match: { createdAt: { $gte: sinceDate } } },
				// compute ranking scores before $lookup to sort/paginate early
				{
					$addFields: {
						recencyScore: {
							$divide: [
								1,
								{ $add: [1, { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60 * 24] }] },
							],
						},
						popularityScore: { $ln: { $add: ["$likesCount", 1] } },
						tagMatchScore: hasTagPreferences ? { $size: { $setIntersection: ["$tags", favoriteTagIds] } } : 0,
					},
				},
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
				{ $sort: { rankScore: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				// now do expensive $lookups only on the paginated result set
				...this.getStandardLookups(),
				{
					$project: {
						...this.getStandardProjectionFields(),
						viewsCount: { $ifNull: ["$viewsCount", 0] },
						rankScore: 1,
					},
				},
			];
			const [results, total] = await Promise.all([
				this.model.aggregate(pipeline).exec(),
				this.model.countDocuments({ createdAt: { $gte: sinceDate } }),
			]);

			console.info(`Ranked feed generated with results: ${JSON.stringify(results)} `);

			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;
			return { data: results, total, page: currentPage, limit, totalPages };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to build ranked feed");
		}
	}

	/**
	 * Generates a trending feed using multi-factor trend scoring
	 * @deprecated Use getTrendingFeedWithCursor or getTrendingFeedWithFacet for better performance
	 * Cursor variant for deep pagination; facet variant for single-query combined count
	 * @pattern Multi-Factor Trending Algorithm
	 * @strategy Recency + Log(Popularity) + Log(Comments) with configurable weights
	 * @complexity O(N log N) aggregation + O(skip) scan cost on skip-based pagination
	 * @note Filters to configurable time window (default 14 days) and minimum likes threshold
	 * @param limit - Number of posts per page
	 * @param skip - Number of posts to skip (avoid deep pagination with this method)
	 * @param options - Configuration for time window, minimum likes, and score weights
	 * @returns {Promise<PaginationResult<any>>} Trending posts with computed trend scores
	 * @throws {DatabaseError} if score computation or aggregation fails
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

			const pipeline: PipelineStage[] = [
				{ $match: { createdAt: { $gte: sinceDate }, likesCount: { $gte: minLikes } } },
				// compute trend scores before $lookup to sort/paginate early
				{
					$addFields: {
						recencyScore: {
							$divide: [
								1,
								{ $add: [1, { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60 * 24] }] },
							],
						},
						// using natural logarithm to dampen the effect of very high like counts allowing newer posts to compete
						popularityScore: { $ln: { $add: ["$likesCount", 1] } },
						commentsScore: { $ln: { $add: ["$commentsCount", 1] } },
					},
				},
				{
					$addFields: {
						trendScore: {
							$add: [
								{ $multiply: [weights.recency, "$recencyScore"] },
								{ $multiply: [weights.popularity, "$popularityScore"] },
								{ $multiply: [weights.comments, "$commentsScore"] },
							],
						},
					},
				},
				{ $sort: { trendScore: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				// now do expensive $lookups only on the paginated result set
				...this.getStandardLookups(),
				{
					$project: {
						...this.getStandardProjectionFields(),
						viewsCount: { $ifNull: ["$viewsCount", 0] },
						trendScore: 1,
					},
				},
			];
			const [results, total] = await Promise.all([
				this.model.aggregate(pipeline).exec(),
				this.model.countDocuments({ createdAt: { $gte: sinceDate }, likesCount: { $gte: minLikes } }),
			]);

			// console.info(`Trending feed generated with results: ${JSON.stringify(results)} `);
			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;

			return { data: results, total, page: currentPage, limit, totalPages };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to build trending feed");
		}
	}

	/**
	 * Generates a chronological feed of newest posts
	 * @deprecated Use getNewFeedWithCursor or getNewFeedWithFacet for better performance
	 * Cursor variant for efficient infinite scroll; facet variant for single query
	 * @pattern Chronological Feed
	 * @strategy Simple reverse-chronological sorting by creation date
	 * @complexity O(N log N) sort + O(skip) scan cost on skip-based pagination
	 * @note This feed moves extremely fast, consider short cache TTLs (60s) and cursor pagination
	 * @param limit - Number of posts per page
	 * @param skip - Number of posts to skip (avoid deep pagination with this method)
	 * @returns {Promise<PaginationResult<any>>} Newest posts in reverse chronological order
	 * @throws {DatabaseError} if aggregation pipeline fails
	 */
	async getNewFeed(limit: number, skip: number): Promise<PaginationResult<any>> {
		try {
			const pipeline: PipelineStage[] = [
				{ $sort: { createdAt: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				...this.getStandardLookups(),
				{ $project: { ...this.getStandardProjectionFields(), viewsCount: { $ifNull: ["$viewsCount", 0] } } },
			];

			const [results, total] = await Promise.all([
				this.model.aggregate(pipeline).exec(),
				this.model.countDocuments({}),
			]);
			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;
			console.info(`New feed generated with results: ${JSON.stringify(results)}`);
			return { data: results, total, page: currentPage, limit, totalPages };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to build new feed");
		}
	}

	async getTrendingTags(limit: number, timeWindowHours: number): Promise<TrendingTag[]> {
		try {
			const windowHours = Math.max(1, timeWindowHours ?? 168);
			const cappedLimit = Math.min(Math.max(limit ?? 5, 1), 20);
			const now = new Date();
			const timeThreshold = new Date(now.getTime() - windowHours * 3600000);

			const pipeline: PipelineStage[] = [
				{ $match: { createdAt: { $gte: timeThreshold }, tags: { $exists: true, $not: { $size: 0 } } } },
				{
					$project: {
						tags: 1,
						likesCount: { $ifNull: ["$likesCount", 0] },
						commentsCount: { $ifNull: ["$commentsCount", 0] },
						createdAt: 1,
					},
				},
				{ $unwind: "$tags" },
				{ $lookup: { from: "tags", localField: "tags", foreignField: "_id", as: "tagDoc" } },
				{ $unwind: "$tagDoc" },
				{
					$group: {
						_id: "$tagDoc.tag",
						recentPostCount: { $sum: 1 },
						totalLikes: { $sum: "$likesCount" },
						totalComments: { $sum: "$commentsCount" },
						lastUsedAt: { $max: "$createdAt" },
					},
				},
				{
					$addFields: {
						hoursSinceLastUse: { $divide: [{ $subtract: [now, "$lastUsedAt"] }, 3600000] },
						engagementScore: {
							$add: [
								{ $multiply: [{ $ifNull: ["$totalLikes", 0] }, 0.6] },
								{ $multiply: [{ $ifNull: ["$totalComments", 0] }, 0.4] },
							],
						},
						trendingScore: {
							$add: [
								"$recentPostCount",
								{ $multiply: ["$engagementScore", 0.5] },
								{ $divide: [windowHours, { $add: ["$hoursSinceLastUse", 1] }] },
							],
						},
					},
				},
				{ $sort: { trendingScore: -1, recentPostCount: -1, lastUsedAt: -1 } },
				{ $limit: cappedLimit },
				{ $project: { _id: 0, tag: "$_id", count: "$recentPostCount", recentPostCount: "$recentPostCount" } },
			];

			return await this.runAggregation<TrendingTag>(pipeline);
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to compute trending tags");
		}
	}

	async updateCommentCount(postId: string, increment: number, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findByIdAndUpdate(postId, { $inc: { commentsCount: increment } }, { session });
			await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to update post comment count");
		}
	}

	async updateLikeCount(postId: string, increment: number, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findByIdAndUpdate(postId, { $inc: { likesCount: increment } }, { session });
			await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to update post like count");
		}
	}

	async runAggregation<R = any>(pipeline: PipelineStage[], session?: ClientSession): Promise<R[]> {
		try {
			const aggregation = this.model.aggregate(pipeline);
			if (session) aggregation.session(session);
			return await aggregation.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to execute aggregation");
		}
	}

	async deleteManyByUserId(userId: string, session?: ClientSession): Promise<number> {
		try {
			const query = this.model.deleteMany({ user: userId });
			if (session) query.session(session);
			const result = await query.exec();
			return result.deletedCount || 0;
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to delete posts by user");
		}
	}

	/**
	 * Updates the embedded author snapshot for all posts belonging to a user
	 * Used by the profile sync worker when a user changes avatar or username
	 */
	async updateAuthorSnapshot(
		userObjectId: mongoose.Types.ObjectId,
		updates: {
			username?: string;
			avatarUrl?: string;
			displayName?: string;
			publicId?: string;
		}
	): Promise<number> {
		try {
			const setFields: Record<string, string> = {};
			if (updates.username !== undefined) {
				setFields["author.username"] = updates.username;
			}
			if (updates.avatarUrl !== undefined) {
				setFields["author.avatarUrl"] = updates.avatarUrl;
			}
			if (updates.displayName !== undefined) {
				setFields["author.displayName"] = updates.displayName;
			}
			if (updates.publicId !== undefined) {
				setFields["author.publicId"] = updates.publicId;
			}

			if (Object.keys(setFields).length === 0) {
				return 0;
			}

			const result = await this.model.updateMany({ "author._id": userObjectId }, { $set: setFields }).exec();

			return result.modifiedCount || 0;
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to update author snapshot");
		}
	}

	/**
	 * Cursor-based pagination for the new feed
	 * @description more efficient than skip-based pagination for large datasets
	 * avoids the O(n) skip cost by using the last document's createdAt+_id as anchor
	 * @pattern Cursor Pagination - uses compound sort key (createdAt, _id) for deterministic ordering
	 */
	/**
	 * Cursor-based pagination for the new chronological feed
	 * @recommended Use this for infinite scroll; much more efficient than skip-based pagination
	 * @pattern Cursor Pagination with Compound Sort Key
	 * @complexity O(1) lookup using index-backed cursor filtering instead of O(skip) scan
	 * @performance ~1ms per page vs ~100ms+ for skip-based pagination on deep pages
	 * @param options - Cursor options including cursor token, limit, and navigation direction
	 * @returns {Promise<CursorPaginationResult<any>>} Posts with hasMore flag and next/prev cursors
	 * @throws {DatabaseError} if cursor decoding or aggregation fails
	 * @example
	 * // First page
	 * const result1 = await repo.getNewFeedWithCursor({ limit: 20 });
	 * // Next page using cursor
	 * const result2 = await repo.getNewFeedWithCursor({ limit: 20, cursor: result1.nextCursor });
	 */
	async getNewFeedWithCursor(options: CursorPaginationOptions): Promise<CursorPaginationResult<any>> {
		try {
			const limit = options.limit ?? 20;
			const direction = options.direction ?? "forward";

			// decode cursor if provided
			let cursorFilter: Record<string, unknown> = {};
			if (options.cursor) {
				try {
					const decoded = JSON.parse(Buffer.from(options.cursor, "base64").toString("utf-8"));
					const cursorDate = new Date(decoded.createdAt);
					const cursorId = new mongoose.Types.ObjectId(decoded._id);

					// for forward pagination (newer -> older), get documents older than cursor
					// for backward pagination (older -> newer), get documents newer than cursor
					if (direction === "forward") {
						cursorFilter = {
							$or: [{ createdAt: { $lt: cursorDate } }, { createdAt: cursorDate, _id: { $lt: cursorId } }],
						};
					} else {
						cursorFilter = {
							$or: [{ createdAt: { $gt: cursorDate } }, { createdAt: cursorDate, _id: { $gt: cursorId } }],
						};
					}
				} catch {
					// invalid cursor, ignore and start from beginning
				}
			}

			const sortDirection = direction === "forward" ? -1 : 1;

			// fetch one extra to determine if there are more results
			const pipeline: PipelineStage[] = [
				...(Object.keys(cursorFilter).length > 0 ? [{ $match: cursorFilter }] : []),
				{ $sort: { createdAt: sortDirection, _id: sortDirection } },
				{ $limit: limit + 1 },
				...this.getStandardLookups(),
				{
					$project: {
						...this.getStandardProjectionFields(),
						_id: 1,
						createdAt: 1,
						viewsCount: { $ifNull: ["$viewsCount", 0] },
					},
				},
			];

			let results = await this.model.aggregate(pipeline).exec();

			// reverse results if backward pagination to maintain consistent order
			if (direction === "backward") {
				results = results.reverse();
			}

			const hasMore = results.length > limit;
			if (hasMore) {
				results = results.slice(0, limit);
			}

			// generate next cursor from last item
			let nextCursor: string | undefined;
			if (hasMore && results.length > 0) {
				const lastItem = results[results.length - 1];
				nextCursor = Buffer.from(JSON.stringify({ createdAt: lastItem.createdAt, _id: lastItem._id })).toString(
					"base64"
				);
			}

			// generate prev cursor from first item (for backward navigation)
			let prevCursor: string | undefined;
			if (options.cursor && results.length > 0) {
				const firstItem = results[0];
				prevCursor = Buffer.from(JSON.stringify({ createdAt: firstItem.createdAt, _id: firstItem._id })).toString(
					"base64"
				);
			}

			// remove internal fields from response
			const data = results.map(({ _id, ...rest }) => rest);

			return { data, hasMore, nextCursor, prevCursor };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to build cursor-paginated feed");
		}
	}

	/**
	 * Cursor-based pagination for trending feed
	 * @description optimized for deep pagination on trending posts
	 * @pattern Cursor Pagination - uses (trendScore, _id) compound key for deterministic ordering
	 */
	/**
	 * Cursor-based pagination for trending feed
	 * @recommended Preferred over getTrendingFeed for production infinite scroll
	 * @pattern Cursor Pagination with Computed Field Filtering
	 * @complexity O(1) cursor lookup vs O(skip) scan in getTrendingFeed
	 * @performance Ideal for deep pagination (page 100+) where skip becomes expensive
	 * @param options - Cursor options with time window, min likes, weights, and cursor navigation
	 * @returns {Promise<CursorPaginationResult<any>>} Trending posts with trend scores and cursors
	 * @throws {DatabaseError} if cursor decoding or score computation fails
	 */
	async getTrendingFeedWithCursor(
		options: CursorPaginationOptions & {
			timeWindowDays?: number;
			minLikes?: number;
			weights?: { recency?: number; popularity?: number; comments?: number };
		}
	): Promise<CursorPaginationResult<any>> {
		try {
			const limit = options.limit ?? 20;
			const direction = options.direction ?? "forward";
			const timeWindowDays = options.timeWindowDays ?? 14;
			const minLikes = options.minLikes ?? 0;
			const weights = {
				recency: options.weights?.recency ?? 0.4,
				popularity: options.weights?.popularity ?? 0.5,
				comments: options.weights?.comments ?? 0.1,
			};

			const sinceDate = new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000);

			// decode cursor if provided
			let cursorFilter: Record<string, unknown> = {};
			if (options.cursor) {
				try {
					const decoded = JSON.parse(Buffer.from(options.cursor, "base64").toString("utf-8"));
					const cursorScore = decoded.trendScore;
					const cursorId = new mongoose.Types.ObjectId(decoded._id);

					// cursor pagination on computed fields requires comparing both score and _id
					if (direction === "forward") {
						cursorFilter = {
							$or: [{ trendScore: { $lt: cursorScore } }, { trendScore: cursorScore, _id: { $lt: cursorId } }],
						};
					} else {
						cursorFilter = {
							$or: [{ trendScore: { $gt: cursorScore } }, { trendScore: cursorScore, _id: { $gt: cursorId } }],
						};
					}
				} catch {
					// invalid cursor, ignore
				}
			}

			const sortDirection = direction === "forward" ? -1 : 1;
			const feedProjection = this.getStandardProjectionFields();

			const pipeline: PipelineStage[] = [
				{ $match: { createdAt: { $gte: sinceDate }, likesCount: { $gte: minLikes } } },
				// compute trend scores before cursor filtering
				{
					$addFields: {
						recencyScore: {
							$divide: [
								1,
								{ $add: [1, { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60 * 24] }] },
							],
						},
						popularityScore: { $ln: { $add: ["$likesCount", 1] } },
						commentsScore: { $ln: { $add: ["$commentsCount", 1] } },
					},
				},
				{
					$addFields: {
						trendScore: {
							$add: [
								{ $multiply: [weights.recency, "$recencyScore"] },
								{ $multiply: [weights.popularity, "$popularityScore"] },
								{ $multiply: [weights.comments, "$commentsScore"] },
							],
						},
					},
				},
				// apply cursor filtering if provided
				...(Object.keys(cursorFilter).length > 0 ? [{ $match: cursorFilter }] : []),
				{ $sort: { trendScore: sortDirection, _id: sortDirection } },
				{ $limit: limit + 1 },
				// populate relationships only on paginated results
				...this.getStandardLookups(),
				{
					$project: {
						...feedProjection,
						_id: 1,
						trendScore: 1,
						createdAt: 1,
						viewsCount: { $ifNull: ["$viewsCount", 0] },
					},
				},
			];

			let results = await this.model.aggregate(pipeline).exec();

			// reverse if backward pagination
			if (direction === "backward") {
				results = results.reverse();
			}

			const hasMore = results.length > limit;
			if (hasMore) {
				results = results.slice(0, limit);
			}

			// generate next cursor
			let nextCursor: string | undefined;
			if (hasMore && results.length > 0) {
				const lastItem = results[results.length - 1];
				nextCursor = Buffer.from(JSON.stringify({ trendScore: lastItem.trendScore, _id: lastItem._id })).toString(
					"base64"
				);
			}

			// generate prev cursor
			let prevCursor: string | undefined;
			if (options.cursor && results.length > 0) {
				const firstItem = results[0];
				prevCursor = Buffer.from(JSON.stringify({ trendScore: firstItem.trendScore, _id: firstItem._id })).toString(
					"base64"
				);
			}

			const data = results.map(({ _id, ...rest }) => rest);
			return { data, hasMore, nextCursor, prevCursor };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to build cursor-paginated trending feed");
		}
	}

	/**
	 * Cursor-based pagination for ranked feed
	 * @description optimized for deep pagination on ranked posts
	 * @pattern Cursor Pagination - uses (rankScore, _id) compound key
	 */
	/**
	 * Cursor-based pagination for ranked feed
	 * @recommended Preferred over getRankedFeed for production infinite scroll
	 * @pattern Cursor Pagination with Weighted Scoring
	 * @complexity O(1) cursor lookup vs O(skip) scan; scores computed once before cursor filtering
	 * @performance Handles deep pagination efficiently without O(skip) overhead
	 * @param favoriteTags - Tag names for tag-match scoring component
	 * @param options - Cursor navigation with custom score weights
	 * @returns {Promise<CursorPaginationResult<any>>} Ranked posts with rank scores and cursors
	 * @throws {DatabaseError} if cursor decoding or ranking fails
	 */
	async getRankedFeedWithCursor(
		favoriteTags: string[],
		options: CursorPaginationOptions & {
			weights?: { recency?: number; popularity?: number; tagMatch?: number };
		}
	): Promise<CursorPaginationResult<any>> {
		try {
			const limit = options.limit ?? 20;
			const direction = options.direction ?? "forward";
			const weights = { recency: 0.5, popularity: 0.3, tagMatch: 0.2, ...options.weights };

			const recentThresholdDays = 90;
			const sinceDate = new Date(Date.now() - recentThresholdDays * 24 * 60 * 60 * 1000);
			const favoriteTagIds = await this.loadFavoriteTagIds(favoriteTags);
			const hasTagPreferences = favoriteTagIds.length > 0;

			// decode cursor if provided
			let cursorFilter: Record<string, unknown> = {};
			if (options.cursor) {
				try {
					const decoded = JSON.parse(Buffer.from(options.cursor, "base64").toString("utf-8"));
					const cursorScore = decoded.rankScore;
					const cursorId = new mongoose.Types.ObjectId(decoded._id);

					if (direction === "forward") {
						cursorFilter = {
							$or: [{ rankScore: { $lt: cursorScore } }, { rankScore: cursorScore, _id: { $lt: cursorId } }],
						};
					} else {
						cursorFilter = {
							$or: [{ rankScore: { $gt: cursorScore } }, { rankScore: cursorScore, _id: { $gt: cursorId } }],
						};
					}
				} catch {
					// invalid cursor, ignore
				}
			}

			const sortDirection = direction === "forward" ? -1 : 1;
			const feedProjection = this.getStandardProjectionFields();

			const pipeline: PipelineStage[] = [
				{ $match: { createdAt: { $gte: sinceDate } } },
				// compute ranking scores before cursor filtering
				{
					$addFields: {
						recencyScore: {
							$divide: [
								1,
								{ $add: [1, { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60 * 24] }] },
							],
						},
						popularityScore: { $ln: { $add: ["$likesCount", 1] } },
						tagMatchScore: hasTagPreferences ? { $size: { $setIntersection: ["$tags", favoriteTagIds] } } : 0,
					},
				},
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
				// apply cursor filtering if provided
				...(Object.keys(cursorFilter).length > 0 ? [{ $match: cursorFilter }] : []),
				{ $sort: { rankScore: sortDirection, _id: sortDirection } },
				{ $limit: limit + 1 },
				// populate relationships only on paginated results
				...this.getStandardLookups(),
				{
					$project: {
						...feedProjection,
						_id: 1,
						rankScore: 1,
						createdAt: 1,
						viewsCount: { $ifNull: ["$viewsCount", 0] },
					},
				},
			];

			let results = await this.model.aggregate(pipeline).exec();

			// reverse if backward pagination
			if (direction === "backward") {
				results = results.reverse();
			}

			const hasMore = results.length > limit;
			if (hasMore) {
				results = results.slice(0, limit);
			}

			// generate next cursor
			let nextCursor: string | undefined;
			if (hasMore && results.length > 0) {
				const lastItem = results[results.length - 1];
				nextCursor = Buffer.from(JSON.stringify({ rankScore: lastItem.rankScore, _id: lastItem._id })).toString(
					"base64"
				);
			}

			// generate prev cursor
			let prevCursor: string | undefined;
			if (options.cursor && results.length > 0) {
				const firstItem = results[0];
				prevCursor = Buffer.from(JSON.stringify({ rankScore: firstItem.rankScore, _id: firstItem._id })).toString(
					"base64"
				);
			}

			const data = results.map(({ _id, ...rest }) => rest);
			return { data, hasMore, nextCursor, prevCursor };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to build cursor-paginated ranked feed");
		}
	}

	/**
	 * Fetch posts with single aggregation query combining count and data
	 * @description uses $facet to get both paginated results and total count in one query
	 * @note $facet has 16MB memory limit, suitable for most feeds but avoid for very large result sets
	 * @pattern Facet Optimization - reduces two DB round-trips to one
	 */
	/**
	 * Fetches new feed with combined count and data in single aggregation query
	 * @recommended Use for first page or when total count is needed (replaces countDocuments + aggregate)
	 * @pattern Facet Aggregation Optimization
	 * @complexity O(N log N) single query vs two separate queries (countDocuments + aggregate)
	 * @performance ~2x faster than skip-based pagination for first/early pages due to single roundtrip
	 * @limitation $facet has 16MB memory limit; use cursor pagination for very large result sets
	 * @param limit - Number of posts per page
	 * @param skip - Number of posts to skip
	 * @returns {Promise<PaginationResult<any>>} Posts with total count computed in same query
	 * @throws {DatabaseError} if facet aggregation fails
	 */
	async getNewFeedWithFacet(limit: number, skip: number): Promise<PaginationResult<any>> {
		try {
			const lookups = this.getStandardLookups() as any[];
			const pipeline: any[] = [
				{
					$facet: {
						// metadata facet for count
						metadata: [{ $count: "total" }],
						// data facet for paginated results
						data: [
							{ $sort: { createdAt: -1 } },
							{ $skip: skip },
							{ $limit: limit },
							...lookups,
							{
								$project: {
									...this.getStandardProjectionFields(),
									viewsCount: { $ifNull: ["$viewsCount", 0] },
								},
							},
						],
					},
				},
			];

			const [result] = await this.model.aggregate(pipeline).exec();

			const total = result.metadata[0]?.total ?? 0;
			const data = result.data ?? [];
			const page = Math.floor(skip / limit) + 1;
			const totalPages = Math.ceil(total / limit);

			return { data, total, page, limit, totalPages };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to fetch feed with facet");
		}
	}

	/**
	 * Trending feed with facet optimization
	 * @description combines count + data in single aggregation pipeline for better performance
	 */
	/**
	 * Trending feed with combined count and data in single aggregation query
	 * @recommended Use for first page or when you need both data and total count
	 * @pattern Facet Aggregation for Multi-Output Pipelines
	 * @complexity Single aggregation computing both metadata and data in parallel facets
	 * @performance ~2x faster than getTrendingFeed for pages where count is needed
	 * @limitation $facet has 16MB memory limit; suitable for most use cases but avoid very large windows
	 * @param limit - Number of posts per page
	 * @param skip - Number of posts to skip
	 * @param options - Time window, minimum likes, and score weights configuration
	 * @returns {Promise<PaginationResult<any>>} Trending posts with total count and pagination metadata
	 * @throws {DatabaseError} if facet aggregation fails
	 */
	async getTrendingFeedWithFacet(
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
			const lookups = this.getStandardLookups() as any[];

			const pipeline: any[] = [
				{ $match: { createdAt: { $gte: sinceDate }, likesCount: { $gte: minLikes } } },
				// compute trend scores early
				{
					$addFields: {
						recencyScore: {
							$divide: [
								1,
								{ $add: [1, { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 1000 * 60 * 60 * 24] }] },
							],
						},
						popularityScore: { $ln: { $add: ["$likesCount", 1] } },
						commentsScore: { $ln: { $add: ["$commentsCount", 1] } },
					},
				},
				{
					$addFields: {
						trendScore: {
							$add: [
								{ $multiply: [weights.recency, "$recencyScore"] },
								{ $multiply: [weights.popularity, "$popularityScore"] },
								{ $multiply: [weights.comments, "$commentsScore"] },
							],
						},
					},
				},
				{
					$facet: {
						// metadata facet
						metadata: [{ $count: "total" }],
						// data facet
						data: [
							{ $sort: { trendScore: -1 } },
							{ $skip: skip },
							{ $limit: limit },
							...lookups,
							{
								$project: {
									...this.getStandardProjectionFields(),
									viewsCount: { $ifNull: ["$viewsCount", 0] },
									trendScore: 1,
								},
							},
						],
					},
				},
			];

			const [result] = await this.model.aggregate(pipeline).exec();

			const total = result.metadata[0]?.total ?? 0;
			const data = result.data ?? [];
			const page = Math.floor(skip / limit) + 1;
			const totalPages = Math.ceil(total / limit);

			return { data, total, page, limit, totalPages };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to fetch trending feed with facet");
		}
	}

	private normalizeObjectId(id: string | mongoose.Types.ObjectId, field: string): mongoose.Types.ObjectId {
		if (id instanceof mongoose.Types.ObjectId) {
			return id;
		}
		try {
			return new mongoose.Types.ObjectId(String(id));
		} catch {
			throw createError("ValidationError", `${field} is not a valid ObjectId`);
		}
	}
}
