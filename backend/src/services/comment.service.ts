import { CommentRepository, TransformedComment } from "../repositories/comment.repository";
import { ImageRepository } from "../repositories/image.repository";
import { UserRepository } from "../repositories/user.repository";
import { createError } from "../utils/errors";
import { IComment } from "../models/comment.model";
import { UnitOfWork } from "../database/UnitOfWork";
import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";

@injectable()
export class CommentService {
	constructor(
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("UserRepository") private readonly userRepository: UserRepository
	) {}

	/**
	 * Create a new comment on an image
	 */
	async createComment(userId: string, imagePublicId: string, content: string): Promise<TransformedComment> {
		// Validate input
		if (!content.trim()) {
			throw createError("ValidationError", "Comment content cannot be empty");
		}

		if (content.length > 500) {
			throw createError("ValidationError", "Comment cannot exceed 500 characters");
		}

		// Check if image exists by public ID
		const image = await this.imageRepository.findByPublicId(imagePublicId);
		if (!image) {
			throw createError("NotFoundError", "Image not found");
		}

		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			// Create comment
			const comment = await this.commentRepository.create(
				{
					content: content.trim(),
					imageId: image._id as mongoose.Types.ObjectId,
					userId: new mongoose.Types.ObjectId(userId),
				} as Partial<IComment>,
				session
			);

			// Increment comment count on image
			await this.imageRepository.updateCommentCount((image._id as mongoose.Types.ObjectId).toString(), 1, session);

			await session.commitTransaction();

			// Return populated comment
			const populatedComment = await this.commentRepository.findByIdTransformed(comment._id.toString());
			return populatedComment!;
		} catch (error) {
			await session.abortTransaction();
			throw error;
		} finally {
			session.endSession();
		}
	}

	async createCommentByPublicId(userPublicId: string, imagePublicId: string, content: string) {
		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) throw createError("NotFoundError", "User not found");
		return this.createComment(user.id, imagePublicId, content);
	}

	/**
	 * Get comments for an image with pagination
	 */
	async getCommentsByImageId(imagePublicId: string, page: number = 1, limit: number = 10) {
		// Validate image exists
		const image = await this.imageRepository.findByPublicId(imagePublicId);
		if (!image) {
			throw createError("NotFoundError", "Image not found");
		}

		return await this.commentRepository.getCommentsByImageId(
			(image._id as mongoose.Types.ObjectId).toString(),
			page,
			limit
		);
	}

	/**
	 * Update comment content (only by comment owner)
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
	 * Delete comment (only by comment owner or image owner)
	 */
	async deleteComment(commentId: string, userId: string): Promise<void> {
		const comment = await this.commentRepository.findById(commentId);
		if (!comment) {
			throw createError("NotFoundError", "Comment not found");
		}

		// Check if user owns the comment or the image
		const image = await this.imageRepository.findById(comment.imageId.toString());
		const isCommentOwner = comment.userId.toString() === userId;
		const isImageOwner = image?.user.toString() === userId;

		if (!isCommentOwner && !isImageOwner) {
			throw createError("ForbiddenError", "You can only delete your own comments or comments on your images");
		}

		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			// Delete comment
			await this.commentRepository.deleteComment(commentId, session);

			// Decrement comment count on image
			await this.imageRepository.updateCommentCount(comment.imageId.toString(), -1, session);

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
	 * Get comments by user ID
	 */
	async getCommentsByUserId(userId: string, page: number = 1, limit: number = 10) {
		return await this.commentRepository.getCommentsByUserId(userId, page, limit);
	}

	/**
	 * Delete all comments for an image (called when image is deleted)
	 */
	async deleteCommentsByImageId(imageId: string, session?: mongoose.ClientSession): Promise<number> {
		return await this.commentRepository.deleteCommentsByImageId(imageId, session);
	}
}
