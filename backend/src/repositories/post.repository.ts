import mongoose, { ClientSession, Model, PipelineStage, SortOrder } from "mongoose";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { IPost, PaginationOptions, PaginationResult, TrendingTag } from "../types";
import { createError } from "../utils/errors";

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

	async incrementViewCount(postId: mongoose.Types.ObjectId, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.findOneAndUpdate({ _id: postId }, { $inc: { viewsCount: 1 } }, { new: true });
			if (session) query.session(session);
			await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to increment post view count");
		}
	}

	/**
	 * returns standard $lookup stages for populating post relationships
	 */
	private getStandardLookups(): PipelineStage[] {
		return [
			{ $lookup: { from: "users", localField: "user", foreignField: "_id", as: "userInfo" } },
			{ $unwind: { path: "$userInfo", preserveNullAndEmptyArrays: true } },
			{ $lookup: { from: "tags", localField: "tags", foreignField: "_id", as: "tagObjects" } },
			{ $lookup: { from: "images", localField: "image", foreignField: "_id", as: "imageDoc" } },
			{ $unwind: { path: "$imageDoc", preserveNullAndEmptyArrays: true } },
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
			createdAt: 1,
			likes: "$likesCount",
			commentsCount: 1,
			userPublicId: "$userInfo.publicId",
			tags: {
				$map: {
					input: { $ifNull: ["$tagObjects", []] },
					as: "tag",
					in: { tag: "$$tag.tag", publicId: "$$tag.publicId" },
				},
			},
			user: {
				publicId: "$userInfo.publicId",
				username: "$userInfo.username",
				avatar: "$userInfo.avatar",
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
				.populate("user", "username avatar publicId")
				.populate("tags", "tag")
				.populate({ path: "image", select: "_id url publicId slug createdAt" });

			if (session) query.session(session);
			return await query.exec();
		} catch (err: any) {
			throw createError("DatabaseError", err.message ?? "failed to load post by id");
		}
	}

	async findByPublicId(publicId: string, session?: ClientSession): Promise<IPost | null> {
		try {
			const query = this.model
				.findOne({ publicId })
				.populate("user", "username avatar publicId")
				.populate("tags", "tag")
				.populate({
					path: "image",
					select: "_id url publicId slug createdAt",
				});

			if (session) query.session(session);
			return await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to load post");
		}
	}

	async findBySlug(slug: string, session?: ClientSession): Promise<IPost | null> {
		try {
			const query = this.model
				.findOne({ slug })
				.populate("user", "username avatar publicId")
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
			const sort: Record<string, SortOrder> = { [sortBy]: sortOrder as SortOrder };

			const userDoc = await this.model.db
				.collection("users")
				.findOne({ publicId: userPublicId }, { projection: { _id: 1 } });
			if (!userDoc) {
				throw createError("NotFoundError", "User not found");
			}

			const userId = new mongoose.Types.ObjectId(userDoc._id);

			const [data, total] = await Promise.all([
				this.model
					.find({ user: userId })
					.populate("user", "username avatar publicId")
					.populate("tags", "tag")
					.populate({ path: "image", select: "url publicId slug -_id" })
					.sort(sort)
					.skip(skip)
					.limit(limit)
					.exec(),
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
					.populate("user", "username avatar publicId")
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

			pipeline.push(
				...this.getStandardLookups(),
				{
					$addFields: {
						tagNames: { $map: { input: { $ifNull: ["$tagObjects", []] }, as: "tag", in: "$$tag.tag" } },
						isPersonalized: hasPreferences
							? {
									$or: [
										{ $in: ["$user", followingObjectIds] },
										{ $gt: [{ $size: { $setIntersection: [{ $ifNull: ["$tagNames", []] }, favoriteTags] } }, 0] },
									],
								}
							: false,
					},
				},
				{ $sort: { isPersonalized: -1, createdAt: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				{
					$project: {
						_id: 0,
						publicId: 1,
						body: 1,
						slug: 1,
						createdAt: 1,
						likes: "$likesCount",
						commentsCount: 1,
						viewsCount: { $ifNull: ["$viewsCount", 0] },
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: { input: "$tagObjects", as: "tag", in: { tag: "$$tag.tag", publicId: "$$tag.publicId" } },
						},
						user: {
							publicId: "$userInfo.publicId",
							username: "$userInfo.username",
							avatar: "$userInfo.avatar",
						},
						image: {
							publicId: "$imageDoc.publicId",
							url: "$imageDoc.url",
							slug: "$imageDoc.slug",
						},
					},
				}
			);
			let results = await this.model.aggregate(pipeline).exec();

			// backfill with new posts if not enough personalized content
			if (results.length < limit) {
				const needed = limit - results.length;
				const existingIds = results.map((post) => post.publicId);

				const backfillPipeline: PipelineStage[] = [
					{ $match: { publicId: { $nin: existingIds } } },
					...this.getStandardLookups(),
					{ $sort: { createdAt: -1 } },
					{ $limit: needed },
					{
						$project: {
							_id: 0,
							publicId: 1,
							body: 1,
							slug: 1,
							createdAt: 1,
							likes: "$likesCount",
							commentsCount: 1,
							viewsCount: { $ifNull: ["$viewsCount", 0] },
							userPublicId: "$userInfo.publicId",
							tags: {
								$map: { input: "$tagObjects", as: "tag", in: { tag: "$$tag.tag", publicId: "$$tag.publicId" } },
							},
							user: {
								publicId: "$userInfo.publicId",
								username: "$userInfo.username",
								avatar: "$userInfo.avatar",
							},
							image: {
								publicId: "$imageDoc.publicId",
								url: "$imageDoc.url",
								slug: "$imageDoc.slug",
							},
						},
					},
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
				...this.getStandardLookups(),
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
				{
					$project: {
						_id: 0,
						publicId: 1,
						body: 1,
						slug: 1,
						createdAt: 1,
						likes: "$likesCount",
						commentsCount: 1,
						viewsCount: { $ifNull: ["$viewsCount", 0] },
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: { input: "$tagObjects", as: "tag", in: { tag: "$$tag.tag", publicId: "$$tag.publicId" } },
						},
						user: {
							publicId: "$userInfo.publicId",
							username: "$userInfo.username",
							avatar: "$userInfo.avatar",
						},
						image: {
							publicId: "$imageDoc.publicId",
							url: "$imageDoc.url",
							slug: "$imageDoc.slug",
						},
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
				...this.getStandardLookups(),
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
				{
					$project: {
						_id: 0,
						publicId: 1,
						body: 1,
						slug: 1,
						createdAt: 1,
						likes: "$likesCount",
						commentsCount: 1,
						viewsCount: { $ifNull: ["$viewsCount", 0] },
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: { input: "$tagObjects", as: "tag", in: { tag: "$$tag.tag", publicId: "$$tag.publicId" } },
						},
						user: {
							publicId: "$userInfo.publicId",
							username: "$userInfo.username",
							avatar: "$userInfo.avatar",
						},
						image: {
							publicId: "$imageDoc.publicId",
							url: "$imageDoc.url",
							slug: "$imageDoc.slug",
						},
						trendScore: 1,
					},
				},
			];
			const [results, total] = await Promise.all([
				this.model.aggregate(pipeline).exec(),
				this.model.countDocuments({ createdAt: { $gte: sinceDate }, likesCount: { $gte: minLikes } }),
			]);

			console.info(`Trending feed generated with results: ${JSON.stringify(results)} `);
			const totalPages = Math.ceil(total / limit);
			const currentPage = Math.floor(skip / limit) + 1;

			return { data: results, total, page: currentPage, limit, totalPages };
		} catch (error: any) {
			throw createError("DatabaseError", error.message ?? "failed to build trending feed");
		}
	}

	async getNewFeed(limit: number, skip: number): Promise<PaginationResult<any>> {
		try {
			const pipeline: PipelineStage[] = [
				...this.getStandardLookups(),
				{ $sort: { createdAt: -1 } },
				{ $skip: skip },
				{ $limit: limit },
				{
					$project: {
						_id: 0,
						publicId: 1,
						body: 1,
						slug: 1,
						createdAt: 1,
						likes: "$likesCount",
						commentsCount: 1,
						viewsCount: { $ifNull: ["$viewsCount", 0] },
						userPublicId: "$userInfo.publicId",
						tags: {
							$map: { input: "$tagObjects", as: "tag", in: { tag: "$$tag.tag", publicId: "$$tag.publicId" } },
						},
						user: {
							publicId: "$userInfo.publicId",
							username: "$userInfo.username",
							avatar: "$userInfo.avatar",
						},
						image: {
							publicId: "$imageDoc.publicId",
							url: "$imageDoc.url",
							slug: "$imageDoc.slug",
						},
					},
				},
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
}
