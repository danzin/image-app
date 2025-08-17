import express from "express";
import { ImageController } from "../controllers/image.controller";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import { ImageValidationSchemas, UserValidationSchemas } from "../utils/schemals/user.schemas";
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
		//get all images
		this.router.get("/", this.controller.getImages);

		// Use slug for SEO-friendly image URLs (optional auth to check if user liked)
		this.router.get(
			"/image/:slug",
			this.optionalAuth,
			new ValidationMiddleware(ImageValidationSchemas.slugAction()).validate(),
			this.controller.getImageBySlug
		);

		// Public: get image by publicId (optional auth to check if user liked)
		this.router.get(
			"/image/:publicId",
			this.optionalAuth,
			new ValidationMiddleware(ImageValidationSchemas.publicIdAction()).validate(),
			this.controller.getImageByPublicId
		);

		// Use username for profile image galleries (public endpoint)
		this.router.get(
			"/user/username/:username",
			new ValidationMiddleware(UserValidationSchemas.usernameAction()).validate(),
			this.controller.getUserImagesByUsername
		);
		this.router.get(
			"/user/id/:publicId",
			new ValidationMiddleware(UserValidationSchemas.publicIdAction()).validate(),
			this.controller.getUserImagesByPublicId
		);

		//return images by selected tags
		this.router.get("/search/tags", this.controller.searchByTags);

		//returns all tags
		this.router.get("/tags", this.controller.getTags);

		//returns image by id (legacy - should be deprecated)
		this.router.get("/:id", this.controller.getImageById);

		// === PROTECTED ROUTES (require authentication) ===
		this.router.use(this.auth);

		//logged in user uploads an image
		this.router.post("/upload", upload.single("image"), this.controller.uploadImage);

		//logged in deletes an image by public ID
		this.router.delete(
			"/image/:publicId",
			new ValidationMiddleware(ImageValidationSchemas.publicIdAction()).validate(),
			this.controller.deleteImageByPublicId
		);

		//logged in deletes an image (legacy - should be deprecated)
		this.router.delete("/:id", this.controller.deleteImage);
	}
	public getRouter(): express.Router {
		return this.router;
	}
}
