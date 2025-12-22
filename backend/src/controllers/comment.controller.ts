import { Request, Response, NextFunction } from "express";
import { CommentService } from "../services/comment.service";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { CommandBus } from "../application/common/buses/command.bus";
import { CreateCommentCommand } from "../application/commands/comments/createComment/createComment.command";
import { DeleteCommentCommand } from "../application/commands/comments/deleteComment/deleteComment.command";
import { LikeCommentCommand } from "../application/commands/comments/likeComment/likeComment.command";

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

	createComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { postPublicId } = req.params;
			const { content, parentId } = req.body;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User authentication required");
			}

			const command = new CreateCommentCommand(decodedUser.publicId, postPublicId, content, parentId ?? null);
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

	getCommentsByPostId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { postPublicId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;
			const parentId = (req.query.parentId as string | undefined) ?? null;

			// Limit max comments per page to prevent abuse
			const maxLimit = Math.min(limit, 50);

			const result = await this.commentService.getCommentsByPostPublicId(postPublicId, page, maxLimit, parentId);
			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	updateComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { commentId } = req.params;
			const { content } = req.body; // Already validated and sanitized by Zod middleware
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User authentication required");
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

	likeComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { commentId } = req.params;
			const { decodedUser } = req;

			if (!decodedUser || !decodedUser.publicId) {
				throw createError("AuthenticationError", "User authentication required");
			}

			const command = new LikeCommentCommand(decodedUser.publicId, commentId);
			const result = await this.commandBus.dispatch(command);
			res.status(200).json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getCommentsByUserId = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { publicId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;

			// Limit max comments per page
			const maxLimit = Math.min(limit, 10);

			const result = await this.commentService.getCommentsByUserPublicId(publicId, page, maxLimit);
			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getCommentThread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { commentId } = req.params;
			const result = await this.commentService.getCommentThread(commentId);

			if (!result.comment) {
				next(createError("NotFoundError", "Comment not found"));
				return;
			}

			res.json(result);
		} catch (error) {
			if (error instanceof Error) {
				next(createError(error.name, error.message));
			} else {
				next(createError("UnknownError", "An unknown error occurred"));
			}
		}
	};

	getCommentReplies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
		try {
			const { commentId } = req.params;
			const page = parseInt(req.query.page as string) || 1;
			const limit = parseInt(req.query.limit as string) || 10;

			const maxLimit = Math.min(limit, 50);

			const result = await this.commentService.getCommentReplies(commentId, page, maxLimit);
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
