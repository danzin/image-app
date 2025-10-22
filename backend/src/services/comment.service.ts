import { CommentRepository, TransformedComment } from "../repositories/comment.repository";
import { PostRepository } from "../repositories/post.repository";
import { UserRepository } from "../repositories/user.repository";
import { createError } from "../utils/errors";
import { IComment } from "types/index";
import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";

@injectable()
export class CommentService {
	constructor(
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository
	) {}

	/**
	 * create a new comment on a post
	 */
	async createComment(userId: string, postPublicId: string, content: string): Promise<TransformedComment> {
		// Validate input
		if (!content.trim()) {
			throw createError("ValidationError", "Comment content cannot be empty");
		}

		if (content.length > 500) {
			throw createError("ValidationError", "Comment cannot exceed 500 characters");
		}

		// Check if post exists by public ID
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

	/**
	 * get comments for a post with pagination
	 */
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

	/**
	 * update comment content (only by comment owner)
	 */
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

	/**
	 * delete comment (only by comment owner or post owner)
	 */
	async deleteComment(commentId: string, userId: string): Promise<void> {
		const comment = await this.commentRepository.findById(commentId);
		if (!comment) {
			throw createError("NotFoundError", "Comment not found");
		}

		const post = await this.postRepository.findById(comment.postId.toString());
		if (!post) {
			throw createError("NotFoundError", "Associated post not found");
		}
		const hydratedPost = await this.postRepository.findByPublicId((post as any).publicId);
		const effectivePost = hydratedPost ?? post;

		const isCommentOwner = comment.userId.toString() === userId;
		const postOwner = (effectivePost as any).user;
		const postOwnerInternalId =
			typeof postOwner === "object" && postOwner !== null && "_id" in postOwner
				? (postOwner as any)._id.toString()
				: (postOwner?.toString?.() ?? "");
		const isPostOwner = postOwnerInternalId === userId;

		if (!isCommentOwner && !isPostOwner) {
			throw createError("ForbiddenError", "You can only delete your own comments or comments on your posts");
		}

		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			// Delete comment
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

	/**
	 * get comments by user ID
	 */
	async getCommentsByUserId(userId: string, page: number = 1, limit: number = 10) {
		return await this.commentRepository.getCommentsByUserId(userId, page, limit);
	}

	/**
	 * delete all comments for a post (called when post is deleted)
	 */
	async deleteCommentsByPostId(postId: string, session?: mongoose.ClientSession): Promise<number> {
		return await this.commentRepository.deleteCommentsByPostId(postId, session);
	}
}
