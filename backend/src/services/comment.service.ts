import { CommentRepository } from "../repositories/comment.repository";
import { PostRepository } from "../repositories/post.repository";
import { UserRepository } from "../repositories/user.repository";
import { createError } from "../utils/errors";
import { IComment, TransformedComment } from "types/index";
import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";

// type for IPost.user that can be ObjectId or populated object
type PostUserField = mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId; toString?: () => string };

@injectable()
export class CommentService {
	constructor(
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository
	) {}

	async createComment(userId: string, postPublicId: string, content: string): Promise<TransformedComment> {
		// Validate
		if (!content.trim()) {
			throw createError("ValidationError", "Comment content cannot be empty");
		}

		if (content.length > 500) {
			throw createError("ValidationError", "Comment cannot exceed 500 characters");
		}

		const post = await this.postRepository.findByPublicId(postPublicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}

		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			// Create comment
			const comment = await this.commentRepository.create(
				{
					content: content.trim(),
					postId: post._id as mongoose.Types.ObjectId,
					userId: new mongoose.Types.ObjectId(userId),
				} as Partial<IComment>,
				session
			);

			// Increment comment count on post
			await this.postRepository.updateCommentCount((post._id as mongoose.Types.ObjectId).toString(), 1, session);

			await session.commitTransaction();

			// Return populated comment
			const populatedComment = await this.commentRepository.findByIdTransformed(comment._id.toString());
			if (!populatedComment) {
				throw createError("InternalError", "Failed to load comment after creation");
			}
			return populatedComment;
		} catch (error) {
			await session.abortTransaction();
			throw error;
		} finally {
			session.endSession();
		}
	}

	async createCommentByPublicId(userPublicId: string, postPublicId: string, content: string) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.createComment(user.id, postPublicId, content);
	}

	async getCommentsByPostPublicId(postPublicId: string, page: number = 1, limit: number = 10) {
		// Validate post exists
		const post = await this.postRepository.findByPublicId(postPublicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}

		return await this.commentRepository.getCommentsByPostId(
			(post._id as mongoose.Types.ObjectId).toString(),
			page,
			limit
		);
	}

	async updateComment(commentId: string, userId: string, content: string): Promise<TransformedComment> {
		// Validate input
		if (!content.trim()) {
			throw createError("ValidationError", "Comment content cannot be empty");
		}

		if (content.length > 500) {
			throw createError("ValidationError", "Comment cannot exceed 500 characters");
		}

		// Check if comment exists and user owns it
		const isOwner = await this.commentRepository.isCommentOwner(commentId, userId);
		if (!isOwner) {
			throw createError("ForbiddenError", "You can only edit your own comments");
		}

		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			const updatedComment = await this.commentRepository.updateComment(commentId, content.trim(), session);

			if (!updatedComment) {
				throw createError("NotFoundError", "Comment not found");
			}

			await session.commitTransaction();
			return updatedComment;
		} catch (error) {
			await session.abortTransaction();
			throw error;
		} finally {
			session.endSession();
		}
	}

	async updateCommentByPublicId(commentId: string, userPublicId: string, content: string) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.updateComment(commentId, user.id, content);
	}

	async deleteComment(commentId: string, userId: string): Promise<void> {
		const comment = await this.commentRepository.findById(commentId);
		if (!comment) {
			throw createError("NotFoundError", "Comment not found");
		}

		const post = await this.postRepository.findById(comment.postId.toString());
		if (!post) {
			throw createError("NotFoundError", "Associated post not found");
		}
		const hydratedPost = await this.postRepository.findByPublicId(post.publicId);
		const effectivePost = hydratedPost ?? post;

		const isCommentOwner = comment.userId.toString() === userId;
		const postOwnerInternalId = this.extractUserInternalId(effectivePost.user);
		const isPostOwner = postOwnerInternalId === userId;

		if (!isCommentOwner && !isPostOwner) {
			throw createError("ForbiddenError", "You can only delete your own comments or comments on your posts");
		}

		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			await this.commentRepository.deleteComment(commentId, session);

			// Decrement comment count on post
			await this.postRepository.updateCommentCount(comment.postId.toString(), -1, session);

			await session.commitTransaction();
		} catch (error) {
			await session.abortTransaction();
			throw error;
		} finally {
			session.endSession();
		}
	}

	async deleteCommentByPublicId(commentId: string, userPublicId: string) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.deleteComment(commentId, user.id);
	}

	async getCommentsByUserPublicId(userPublicId: string, page: number = 1, limit: number = 10) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		return await this.commentRepository.getCommentsByUserId(user.id, page, limit);
	}

	async getCommentsByUserId(userId: string, page: number = 1, limit: number = 10) {
		return await this.commentRepository.getCommentsByUserId(userId, page, limit);
	}

	async deleteCommentsByPostId(postId: string, session?: mongoose.ClientSession): Promise<number> {
		return await this.commentRepository.deleteCommentsByPostId(postId, session);
	}

	// extracts internal user id from IPost.user which can be ObjectId or populated object
	private extractUserInternalId(user: PostUserField): string {
		if (!user) return "";
		if (user instanceof mongoose.Types.ObjectId) {
			return user.toString();
		}
		if (typeof user === "object" && "_id" in user && user._id) {
			return user._id.toString();
		}
		return "";
	}
}
