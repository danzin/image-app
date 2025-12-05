import { Model, ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { IComment, PopulatedCommentLean, TransformedComment } from "types/index";
import { inject, injectable } from "tsyringe";

@injectable()
export class CommentRepository extends BaseRepository<IComment> {
	constructor(@inject("CommentModel") model: Model<IComment>) {
		super(model);
	}

	/**
	 * Get comments for a specific post with pagination
	 */
	async getCommentsByPostId(
		postId: string,
		page: number = 1,
		limit: number = 10,
		parentId: string | null = null
	): Promise<{
		comments: TransformedComment[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const skip = (page - 1) * limit;
		const filter: any = { postId };
		filter.parentId = parentId ? parentId : null;

		const [comments, total] = await Promise.all([
			this.model
				.find(filter)
				.populate("userId", "publicId username avatar")
				.populate("postId", "publicId")
				.sort({ createdAt: -1 }) // Newest first
				.skip(skip)
				.limit(limit)
				.lean<PopulatedCommentLean[]>(),
			this.model.countDocuments(filter),
		]);

		// Transform the data to match frontend interface
		const transformedComments = comments.map((comment) => ({
			id: comment._id.toString(),
			content: comment.content,
			postPublicId: comment.postId.publicId,
			parentId: comment.parentId ? comment.parentId.toString() : null,
			replyCount: comment.replyCount ?? 0,
			depth: comment.depth ?? 0,
			likesCount: comment.likesCount ?? 0,
			user: {
				publicId: comment.userId.publicId,
				username: comment.userId.username,
				avatar: comment.userId.avatar,
			},
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			isEdited: comment.isEdited,
		}));

		return {
			comments: transformedComments,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	async getCommentsByUserId(
		userId: string,
		page: number = 1,
		limit: number = 10
	): Promise<{
		comments: TransformedComment[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const skip = (page - 1) * limit;

		const [comments, total] = await Promise.all([
			this.model
				.find({ userId })
				.populate("postId", "slug publicId")
				.populate("userId", "publicId username avatar")
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.lean<PopulatedCommentLean[]>(),
			this.model.countDocuments({ userId }),
		]);

		// Transform the data to match frontend interface
		const transformedComments = comments.map((comment) => ({
			id: comment._id.toString(),
			content: comment.content,
			postPublicId: comment.postId.publicId,
			parentId: comment.parentId ? comment.parentId.toString() : null,
			replyCount: comment.replyCount ?? 0,
			depth: comment.depth ?? 0,
			likesCount: comment.likesCount ?? 0,
			user: {
				publicId: comment.userId.publicId,
				username: comment.userId.username,
				avatar: comment.userId.avatar,
			},
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			isEdited: comment.isEdited,
		}));

		return {
			comments: transformedComments,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}

	/**
	 * Update comment content and mark as edited
	 */
	async updateComment(commentId: string, content: string, session?: ClientSession): Promise<TransformedComment | null> {
		const comment = await this.model
			.findByIdAndUpdate(
				commentId,
				{
					content,
					isEdited: true,
					updatedAt: new Date(),
				},
				{ new: true, session }
			)
			.populate("userId", "publicId username avatar")
			.populate("postId", "publicId")
			.lean<PopulatedCommentLean>();

		if (!comment) return null;

		// Transform the data to match frontend interface
		return {
			id: comment._id.toString(),
			content: comment.content,
			postPublicId: comment.postId.publicId,
			parentId: comment.parentId ? comment.parentId.toString() : null,
			replyCount: comment.replyCount ?? 0,
			depth: comment.depth ?? 0,
			likesCount: comment.likesCount ?? 0,
			user: {
				publicId: comment.userId.publicId,
				username: comment.userId.username,
				avatar: comment.userId.avatar,
			},
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			isEdited: comment.isEdited,
		};
	}

	/**
	 * Find comment by ID with user population and transformation
	 */
	async findByIdTransformed(commentId: string): Promise<TransformedComment | null> {
		const comment = await this.model
			.findById(commentId)
			.populate("userId", "publicId username avatar")
			.populate("postId", "publicId")
			.lean<PopulatedCommentLean>();

		if (!comment) return null;

		// Transform the data to match frontend interface
		return {
			id: comment._id.toString(),
			content: comment.content,
			postPublicId: comment.postId.publicId,
			parentId: comment.parentId ? comment.parentId.toString() : null,
			replyCount: comment.replyCount ?? 0,
			depth: comment.depth ?? 0,
			likesCount: comment.likesCount ?? 0,
			user: {
				publicId: comment.userId.publicId,
				username: comment.userId.username,
				avatar: comment.userId.avatar,
			},
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			isEdited: comment.isEdited,
		};
	}

	async updateReplyCount(commentId: string, delta: number, session?: ClientSession): Promise<void> {
		await this.model.updateOne({ _id: commentId }, { $inc: { replyCount: delta } }, { session });
	}

	async updateLikesCount(commentId: string, delta: number, session?: ClientSession): Promise<void> {
		await this.model.updateOne({ _id: commentId }, { $inc: { likesCount: delta } }, { session });
	}
	async deleteComment(commentId: string, session?: ClientSession): Promise<IComment | null> {
		return await this.model.findByIdAndDelete(commentId, { session }).populate("userId", "username avatar").lean();
	}

	async isCommentOwner(commentId: string, userId: string): Promise<boolean> {
		const comment = await this.model.findById(commentId).lean();
		return comment ? comment.userId.toString() === userId : false;
	}

	async deleteCommentsByPostId(postId: string, session?: ClientSession): Promise<number> {
		const result = await this.model.deleteMany({ postId }, { session });
		return result.deletedCount || 0;
	}

	async deleteCommentsByUserId(userId: string, session?: ClientSession): Promise<number> {
		const result = await this.model.deleteMany({ userId }, { session });
		return result.deletedCount || 0;
	}
}
