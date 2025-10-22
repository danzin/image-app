import express from "express";
import { UserController } from "../controllers/user.controller";
import { AuthFactory } from "../middleware/authentication.middleware";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import upload from "../config/multer";
import { UserSchemas } from "../utils/schemals/user.schemas";
import { inject, injectable } from "tsyringe";

@injectable()
export class UserRoutes {
	private router: express.Router;
	private auth = AuthFactory.bearerToken().handle();

	constructor(@inject("UserController") private readonly userController: UserController) {
		this.router = express.Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		// === Public Routes (no authentication required) ===

		// Authentication endpoints
		this.router.post(
			"/register",
			new ValidationMiddleware({ body: UserSchemas.registration() }).validate(),
			this.userController.register
		);

		this.router.post(
			"/login",
			new ValidationMiddleware({ body: UserSchemas.login() }).validate(),
			this.userController.login
		);

		this.router.post("/logout", this.userController.logout);

		// Public user data endpoints
		this.router.get("/users", this.userController.getUsers);

		// Get user profile by username (SEO-friendly, public)
		this.router.get(
			"/profile/:username",
			new ValidationMiddleware({ params: UserSchemas.usernameParams() }).validate(),
			this.userController.getUserByUsername
		);

		// Get user by public ID (for API integrations)
		this.router.get(
			"/public/:publicId",
			new ValidationMiddleware({ params: UserSchemas.publicIdParams() }).validate(),
			this.userController.getUserByPublicId
		);

		// === Protected Routes (authentication required) ===
		this.router.use(this.auth); // All routes below require authentication

		// Current user operations
		this.router.get("/me", this.userController.getMe);
		this.router.get("/suggestions/who-to-follow", this.userController.getWhoToFollow);
		this.router.put(
			"/me/edit",
			new ValidationMiddleware({ body: UserSchemas.updateProfile() }).validate(),
			this.userController.updateProfile
		);
		this.router.put("/me/avatar", upload.single("avatar"), this.userController.updateAvatar);
		this.router.put("/me/cover", upload.single("cover"), this.userController.updateCover);
		this.router.put(
			"/me/change-password",
			new ValidationMiddleware({ body: UserSchemas.changePassword() }).validate(),
			this.userController.changePassword
		);

		// Social actions (using public IDs for security)
		this.router.post(
			"/follow/:publicId",
			new ValidationMiddleware({ params: UserSchemas.publicIdParams() }).validate(),
			this.userController.followUserByPublicId
		);

		this.router.delete(
			"/unfollow/:publicId",
			new ValidationMiddleware({ params: UserSchemas.publicIdParams() }).validate(),
			this.userController.unfollowUserByPublicId
		);

		this.router.get(
			"/follows/:publicId",
			new ValidationMiddleware({ params: UserSchemas.publicIdParams() }).validate(),
			this.userController.checkFollowStatus
		);

		// Post interactions (using public IDs)
		this.router.post(
			"/like/post/:publicId",
			new ValidationMiddleware({ params: UserSchemas.publicIdParams() }).validate(),
			this.userController.likeActionByPublicId
		);

		// Account deletion (self-deletion only, admins use separate endpoints)
		this.router.delete("/me", this.userController.deleteMyAccount);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
