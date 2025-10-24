import express from "express";
import { ImageController } from "../controllers/image.controller";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import { slugSchema, publicIdSchema, searchByTagsSchema } from "../utils/schemas/post.schemas";
import { usernameSchema } from "../utils/schemas/user.schemas";
import upload from "../config/multer";
import { AuthFactory } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";

@injectable()
export class ImageRoutes {
	public router: express.Router;
	private auth = AuthFactory.bearerToken().handle();
	private optionalAuth = AuthFactory.optionalBearerToken().handleOptional();

	constructor(@inject("ImageController") private controller: ImageController) {
		this.router = express.Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		this.router.get("/", this.controller.listPosts);

		// Use slug for SEO-friendly image URLs (optional auth to check if user liked)
		this.router.get(
			"/image/:slug",
			this.optionalAuth,
			new ValidationMiddleware({ params: slugSchema }).validate(),
			this.controller.getPostBySlug
		);

		// Public: get image by publicId (optional auth to check if user liked)
		this.router.get(
			"/image/:publicId",
			this.optionalAuth,
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.controller.getPostByPublicId
		);

		// Use username for profile image galleries (public endpoint)
		this.router.get(
			"/user/username/:username",
			new ValidationMiddleware({ params: usernameSchema }).validate(),
			this.controller.getPostsByUsername
		);
		this.router.get(
			"/user/id/:publicId",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.controller.getPostsByUserPublicId
		);

		this.router.get(
			"/search/tags",
			new ValidationMiddleware({ query: searchByTagsSchema }).validate(),
			this.controller.searchByTags
		);

		this.router.get("/tags", this.controller.listTags);

		// === PROTECTED ROUTES (require authentication) ===
		this.router.use(this.auth);

		//logged in user uploads an image
		this.router.post("/upload", upload.single("image"), this.controller.createPost);

		//logged in deletes an image by public ID
		this.router.delete(
			"/image/:publicId",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.controller.deletePost
		);
	}
	public getRouter(): express.Router {
		return this.router;
	}
}
