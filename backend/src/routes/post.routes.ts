import express from "express";
import { inject, injectable } from "tsyringe";
import { PostController } from "../controllers/post.controller";
import { AuthFactory } from "../middleware/authentication.middleware";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import { ImageValidationSchemas, UserValidationSchemas } from "../utils/schemals/user.schemas";
import upload from "../config/multer";

@injectable()
export class PostRoutes {
	private readonly router = express.Router();
	private readonly auth = AuthFactory.bearerToken().handle();
	private readonly optionalAuth = AuthFactory.optionalBearerToken().handleOptional();

	constructor(@inject("PostController") private readonly postController: PostController) {
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		this.router.get("/", this.postController.listPosts);

		this.router.get(
			"/slug/:slug",
			this.optionalAuth,
			new ValidationMiddleware(ImageValidationSchemas.slugAction()).validate(),
			this.postController.getPostBySlug
		);

		this.router.get(
			"/:publicId",
			this.optionalAuth,
			new ValidationMiddleware(ImageValidationSchemas.publicIdAction()).validate(),
			this.postController.getPostByPublicId
		);

		this.router.get(
			"/user/username/:username",
			new ValidationMiddleware(UserValidationSchemas.usernameAction()).validate(),
			this.postController.getPostsByUsername
		);

		this.router.get(
			"/user/:publicId",
			new ValidationMiddleware(UserValidationSchemas.publicIdAction()).validate(),
			this.postController.getPostsByUserPublicId
		);

		this.router.get("/search/tags", this.postController.searchByTags);
		this.router.get("/tags", this.postController.listTags);

		this.router.use(this.auth);
		this.router.post("/", upload.single("image"), this.postController.createPost);
		this.router.delete(
			"/:publicId",
			new ValidationMiddleware(ImageValidationSchemas.publicIdAction()).validate(),
			this.postController.deletePost
		);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
