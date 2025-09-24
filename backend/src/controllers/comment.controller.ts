import { Request, Response, NextFunction } from "express";
import { CommentService } from "../services/comment.service";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { CommandBus } from "../application/common/buses/command.bus";
import { CreateCommentCommand } from "../application/commands/comments/createComment/createComment.command";
import { DeleteCommentCommand } from "../application/commands/comments/deleteComment/deleteComment.command";

/**
 * Comment Controller
 * Handles HTTP requests for comment-related operations
 */
@injectable()
export class CommentController {
	constructor(
		@inject("CommentService") private readonly commentService: CommentService,
		@inject("CommandBus") private readonly commandBus: CommandBus
	) {}

	/**
	 * Create a new comment on an image
	 * POST /api/images/:imagePublicId/comments
	 */
	createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { imagePublicId } = req.params;
			const { content } = req.body;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User authentication required");
			}

			if (!content || typeof content !== "string") {
				throw createError("ValidationError", "Comment content is required");
			}

			// Use CQRS command instead of service
			const command = new CreateCommentCommand(decodedUser.publicId, imagePublicId, content);
			const comment = await this.commandBus.dispatch(command);

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

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User authentication required");
			}

			if (!content || typeof content !== "string") {
				throw createError("ValidationError", "Comment content is required");
			}

			const comment = await this.commentService.updateCommentByPublicId(commentId, decodedUser.publicId, content);
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

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User authentication required");
			}

			// Use CQRS command instead of service
			const command = new DeleteCommentCommand(commentId, decodedUser.publicId);
			await this.commandBus.dispatch(command);

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
