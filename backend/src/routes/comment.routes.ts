import express from "express";
import { CommentController } from "../controllers/comment.controller";
import { AuthFactory } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import {
	createCommentSchema,
	updateCommentSchema,
	commentIdSchema,
	commentsQuerySchema,
} from "../utils/schemas/comment.schemas";
import { postPublicIdSchema } from "../utils/schemas/post.schemas";
import { publicIdSchema as userPublicIdSchema } from "../utils/schemas/user.schemas";

@injectable()
export class CommentRoutes {
	private router = express.Router();
	private auth = AuthFactory.bearerToken().handle();

	constructor(@inject("CommentController") private readonly commentController: CommentController) {
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		// Comments on posts
		this.router.post(
			"/posts/:postPublicId/comments",
			this.auth,
			new ValidationMiddleware({ params: postPublicIdSchema, body: createCommentSchema }).validate(),
			this.commentController.createComment
		);

		this.router.get(
			"/posts/:postPublicId/comments",
			new ValidationMiddleware({ params: postPublicIdSchema, query: commentsQuerySchema }).validate(),
			this.commentController.getCommentsByPostId
		);

		// Comment management
		this.router.put(
			"/comments/:commentId",
			this.auth,
			new ValidationMiddleware({ params: commentIdSchema, body: updateCommentSchema }).validate(),
			this.commentController.updateComment
		);

		this.router.post(
			"/comments/:commentId/like",
			this.auth,
			new ValidationMiddleware({ params: commentIdSchema }).validate(),
			this.commentController.likeComment
		);

		this.router.delete(
			"/comments/:commentId",
			this.auth,
			new ValidationMiddleware({ params: commentIdSchema }).validate(),
			this.commentController.deleteComment
		);

		// Comment thread view
		this.router.get(
			"/comments/:commentId/thread",
			new ValidationMiddleware({ params: commentIdSchema }).validate(),
			this.commentController.getCommentThread
		);

		this.router.get(
			"/comments/:commentId/replies",
			new ValidationMiddleware({ params: commentIdSchema, query: commentsQuerySchema }).validate(),
			this.commentController.getCommentReplies
		);

		// User comments
		this.router.get(
			"/users/:publicId/comments",
			new ValidationMiddleware({ params: userPublicIdSchema }).validate(),
			this.commentController.getCommentsByUserId
		);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
