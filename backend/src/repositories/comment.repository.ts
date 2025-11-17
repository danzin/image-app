import { Model, ClientSession } from "mongoose";
import { BaseRepository } from "./base.repository";
import { IComment } from "types/index";
import { inject, injectable } from "tsyringe";

export interface TransformedComment {
	id: string;
	content: string;
	postPublicId: string;
	user: {
		publicId: string;
		username: string;
		avatar?: string;
	};
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

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
				.find({ postId })
				.populate("userId", "publicId username avatar")
				.populate("postId", "publicId")
				.sort({ createdAt: -1 }) // Newest first
				.skip(skip)
				.limit(limit)
				.lean(),
			this.model.countDocuments({ postId }),
		]);

		// Transform the data to match frontend interface
		const transformedComments = comments.map((comment: any) => ({
			id: comment._id.toString(),
			content: comment.content,
			postPublicId: comment.postId.publicId,
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
	 * Get comments by user ID
	 */
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
				.lean(),
			this.model.countDocuments({ userId }),
		]);

		// Transform the data to match frontend interface
		const transformedComments = comments.map((comment: any) => ({
			id: comment._id.toString(),
			content: comment.content,
			postPublicId: comment.postId.publicId,
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
			.lean();

		if (!comment) return null;

		// Transform the data to match frontend interface
		return {
			id: (comment as any)._id.toString(),
			content: (comment as any).content,
			postPublicId: (comment as any).postId.publicId,
			user: {
				publicId: (comment as any).userId.publicId,
				username: (comment as any).userId.username,
				avatar: (comment as any).userId.avatar,
			},
			createdAt: (comment as any).createdAt,
			updatedAt: (comment as any).updatedAt,
			isEdited: (comment as any).isEdited,
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
			.lean();

		if (!comment) return null;

		// Transform the data to match frontend interface
		return {
			id: (comment as any)._id.toString(),
			content: (comment as any).content,
			postPublicId: (comment as any).postId.publicId,
			user: {
				publicId: (comment as any).userId.publicId,
				username: (comment as any).userId.username,
				avatar: (comment as any).userId.avatar,
			},
			createdAt: (comment as any).createdAt,
			updatedAt: (comment as any).updatedAt,
			isEdited: (comment as any).isEdited,
		};
	}
	async deleteComment(commentId: string, session?: ClientSession): Promise<IComment | null> {
		return await this.model.findByIdAndDelete(commentId, { session }).populate("userId", "username avatar").lean();
	}

	/**
	 * Check if user owns the comment
	 */
	async isCommentOwner(commentId: string, userId: string): Promise<boolean> {
		const comment = await this.model.findById(commentId).lean();
		return comment ? comment.userId.toString() === userId : false;
	}

	/**
	 * Delete all comments for a post (when post is deleted)
	 */
	async deleteCommentsByPostId(postId: string, session?: ClientSession): Promise<number> {
		const result = await this.model.deleteMany({ postId }, { session });
		return result.deletedCount || 0;
	}

	/**
	 * Delete all comments by a user (when user is deleted)
	 */
	async deleteCommentsByUserId(userId: string, session?: ClientSession): Promise<number> {
		const result = await this.model.deleteMany({ userId }, { session });
		return result.deletedCount || 0;
	}
}
