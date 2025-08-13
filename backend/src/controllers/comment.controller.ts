import { Request, Response, NextFunction } from "express";
import { CommentService } from "../services/comment.service";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

/**
 * Comment Controller
 * Handles HTTP requests for comment-related operations
 */
@injectable()
export class CommentController {
	constructor(@inject("CommentService") private readonly commentService: CommentService) {}

	/**
	 * Create a new comment on an image
	 * POST /api/images/:imagePublicId/comments
	 */
	createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { imagePublicId } = req.params;
			const { content } = req.body;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.id) {
				throw createError("AuthenticationError", "User authentication required");
			}

			if (!content || typeof content !== "string") {
				throw createError("ValidationError", "Comment content is required");
			}

			const comment = await this.commentService.createComment(decodedUser.id, imagePublicId, content);
			res.status(201).json(comment);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	/**
	 * Get comments for an image with pagination
	 * GET /api/images/:imagePublicId/comments?page=1&limit=10
	 */
	getCommentsByImageId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { imagePublicId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;

			// Limit max comments per page to prevent abuse
			const maxLimit = Math.min(limit, 50);

			const result = await this.commentService.getCommentsByImageId(imagePublicId, page, maxLimit);
			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	/**
	 * Update comment content
	 * PUT /api/comments/:commentId
	 */
	updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { commentId } = req.params;
			const { content } = req.body;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.id) {
				throw createError("AuthenticationError", "User authentication required");
			}

			if (!content || typeof content !== "string") {
				throw createError("ValidationError", "Comment content is required");
			}

			const comment = await this.commentService.updateComment(commentId, decodedUser.id, content);
			res.json(comment);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	/**
	 * Delete a comment
	 * DELETE /api/comments/:commentId
	 */
	deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { commentId } = req.params;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.id) {
				throw createError("AuthenticationError", "User authentication required");
			}

			await this.commentService.deleteComment(commentId, decodedUser.id);
			res.status(204).send(); // No content response
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	/**
	 * Get comments by user ID
	 * GET /api/users/:userId/comments?page=1&limit=10
	 */
	getCommentsByUserId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { userId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;

			// Limit max comments per page
			const maxLimit = Math.min(limit, 50);

			const result = await this.commentService.getCommentsByUserId(userId, page, maxLimit);
			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};
}
