import express from "express";
import { CommentController } from "../controllers/comment.controller";
import { AuthFactory } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";

@injectable()
export class CommentRoutes {
	private router = express.Router();
	private auth = AuthFactory.bearerToken().handle();

	constructor(@inject("CommentController") private readonly commentController: CommentController) {
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		// Comments on images
		this.router.post("/images/:imagePublicId/comments", this.auth, this.commentController.createComment);

		this.router.get("/images/:imagePublicId/comments", this.commentController.getCommentsByImageId);

		// Comment management
		this.router.put("/comments/:commentId", this.auth, this.commentController.updateComment);

		this.router.delete("/comments/:commentId", this.auth, this.commentController.deleteComment);

		// User comments
		this.router.get("/users/:userId/comments", this.commentController.getCommentsByUserId);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
