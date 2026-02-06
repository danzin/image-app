import { CommentRepository } from "@/repositories/comment.repository";
import { PostRepository } from "@/repositories/post.repository";
import { UserRepository } from "@/repositories/user.repository";
import { UnitOfWork } from "@/database/UnitOfWork";
import { createError } from "@/utils/errors";
import { IComment, TransformedComment } from "@/types";
import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";

// type for IPost.user that can be ObjectId or populated object
type PostUserField = mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId; toString?: () => string };

@injectable()
export class CommentService {
	constructor(
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
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

		let createdCommentId: string;

		await this.unitOfWork.executeInTransaction(async (session) => {
			// create comment
			const comment = await this.commentRepository.create(
				{
					content: content.trim(),
					postId: post._id as mongoose.Types.ObjectId,
					userId: new mongoose.Types.ObjectId(userId),
				} as Partial<IComment>,
				session,
			);

			createdCommentId = comment._id.toString();

			// increment comment count on post
			await this.postRepository.updateCommentCount((post._id as mongoose.Types.ObjectId).toString(), 1, session);
		});

		// return populated comment (after commit)
		const populatedComment = await this.commentRepository.findByIdTransformed(createdCommentId!);
		if (!populatedComment) {
			throw createError("InternalError", "Failed to load comment after creation");
		}
		return populatedComment;
	}

	async createCommentByPublicId(userPublicId: string, postPublicId: string, content: string) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.createComment(user.id, postPublicId, content);
	}

	async getCommentsByPostPublicId(
		postPublicId: string,
		page: number = 1,
		limit: number = 10,
		parentId: string | null = null,
	) {
		// Validate post exists
		const post = await this.postRepository.findByPublicId(postPublicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}

		return await this.commentRepository.getCommentsByPostId(
			(post._id as mongoose.Types.ObjectId).toString(),
			page,
			limit,
			parentId,
		);
	}

	async updateComment(commentId: string, userId: string, content: string, isAdmin: boolean = false): Promise<TransformedComment> {
		// Validate input
		if (!content.trim()) {
			throw createError("ValidationError", "Comment content cannot be empty");
		}

		if (content.length > 500) {
			throw createError("ValidationError", "Comment cannot exceed 500 characters");
		}

		// Check if comment exists and user owns it
		const isOwner = await this.commentRepository.isCommentOwner(commentId, userId);
		if (!isOwner && !isAdmin) {
			throw createError("ForbiddenError", "You can only edit your own comments");
		}

		let updatedComment: TransformedComment | null = null;

		await this.unitOfWork.executeInTransaction(async (session) => {
			updatedComment = await this.commentRepository.updateComment(commentId, content.trim(), session);

			if (!updatedComment) {
				throw createError("NotFoundError", "Comment not found");
			}
		});

		return updatedComment!;
	}

	async updateCommentByPublicId(commentId: string, userPublicId: string, content: string) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.updateComment(commentId, user.id, content, user.isAdmin);
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

		const isCommentOwner = comment.userId && comment.userId.toString() === userId;
		const postOwnerInternalId = this.extractUserInternalId(effectivePost.user);
		const isPostOwner = postOwnerInternalId === userId;

		if (!isCommentOwner && !isPostOwner) {
			throw createError("ForbiddenError", "You can only delete your own comments or comments on your posts");
		}

		await this.unitOfWork.executeInTransaction(async (session) => {
			await this.commentRepository.deleteComment(commentId, session);

			// decrement comment count on post
			await this.postRepository.updateCommentCount(comment.postId.toString(), -1, session);
		});
	}

	async deleteCommentByPublicId(commentId: string, userPublicId: string) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.deleteComment(commentId, user.id);
	}

	async getCommentsByUserPublicId(
		userPublicId: string,
		page: number = 1,
		limit: number = 10,
		sortBy: string = "createdAt",
		sortOrder: "asc" | "desc" = "desc",
	) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		return await this.commentRepository.getCommentsByUserId(user.id, page, limit, sortBy, sortOrder);
	}

	async getCommentsByUserId(
		userId: string,
		page: number = 1,
		limit: number = 10,
		sortBy: string = "createdAt",
		sortOrder: "asc" | "desc" = "desc",
	) {
		return await this.commentRepository.getCommentsByUserId(userId, page, limit, sortBy, sortOrder);
	}

	async deleteCommentsByPostId(postId: string, session?: mongoose.ClientSession): Promise<number> {
		return await this.commentRepository.deleteCommentsByPostId(postId, session);
	}

	/**
	 * Get a single comment with its ancestor chain
	 */
	async getCommentThread(commentId: string) {
		return await this.commentRepository.getCommentWithAncestors(commentId);
	}

	/**
	 * Get direct replies to a comment
	 */
	async getCommentReplies(commentId: string, page: number = 1, limit: number = 10) {
		const comment = await this.commentRepository.findById(commentId);
		if (!comment) {
			throw createError("NotFoundError", "Comment not found");
		}
		return await this.commentRepository.getCommentReplies(commentId, page, limit);
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
