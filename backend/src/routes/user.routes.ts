import express from "express";
import { UserController } from "../controllers/user.controller";
import {
	AuthFactory,
	forgotPasswordEmailRateLimit,
	forgotPasswordIpRateLimit,
} from "../middleware/authentication.middleware";
import { honeypotMiddleware } from "../middleware/honeypot.middleware";
import { ValidationMiddleware } from "../middleware/validation.middleware";
import upload from "../config/multer";
import {
	registrationSchema,
	loginSchema,
	usernameSchema,
	publicIdSchema,
	updateProfileSchema,
	changePasswordSchema,
	requestPasswordResetSchema,
	resetPasswordSchema,
	verifyEmailSchema,
} from "../utils/schemas/user.schemas";
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
			honeypotMiddleware,
			new ValidationMiddleware({ body: registrationSchema }).validate(),
			this.userController.register,
		);

		this.router.post(
			"/login",
			honeypotMiddleware,
			new ValidationMiddleware({ body: loginSchema }).validate(),
			this.userController.login,
		);

		this.router.post("/logout", this.userController.logout);

		this.router.post(
			"/forgot-password",
			forgotPasswordIpRateLimit,
			honeypotMiddleware,
			new ValidationMiddleware({ body: requestPasswordResetSchema }).validate(),
			forgotPasswordEmailRateLimit,
			this.userController.requestPasswordReset,
		);

		this.router.post(
			"/reset-password",
			new ValidationMiddleware({ body: resetPasswordSchema }).validate(),
			this.userController.resetPassword,
		);

		this.router.post(
			"/verify-email",
			new ValidationMiddleware({ body: verifyEmailSchema }).validate(),
			this.userController.verifyEmail,
		);

		// Public user data endpoints
		this.router.get("/users", this.userController.getUsers);

		this.router.get(
			"/profile/:username",
			new ValidationMiddleware({ params: usernameSchema }).validate(),
			this.userController.getUserByUsername,
		);

		this.router.get(
			"/public/:publicId",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.userController.getUserByPublicId,
		);

		// followers/following lists (public)
		this.router.get(
			"/:publicId/followers",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.userController.getFollowers,
		);

		this.router.get(
			"/:publicId/following",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.userController.getFollowing,
		);

		// === Protected Routes (authentication required) ===
		this.router.use(this.auth);

		// Current user operations
		this.router.get("/me", this.userController.getMe);
		this.router.get("/suggestions/who-to-follow", this.userController.getWhoToFollow);
		this.router.put(
			"/me/edit",
			new ValidationMiddleware({ body: updateProfileSchema }).validate(),
			this.userController.updateProfile,
		);
		this.router.put("/me/avatar", upload.single("avatar"), this.userController.updateAvatar);
		this.router.put("/me/cover", upload.single("cover"), this.userController.updateCover);
		this.router.put(
			"/me/change-password",
			new ValidationMiddleware({ body: changePasswordSchema }).validate(),
			this.userController.changePassword,
		);

		// Social actions
		this.router.post(
			"/follow/:publicId",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.userController.followUserByPublicId,
		);

		this.router.delete(
			"/unfollow/:publicId",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.userController.unfollowUserByPublicId,
		);

		this.router.get(
			"/follows/:publicId",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.userController.checkFollowStatus,
		);

		// Post interactions
		this.router.post(
			"/like/post/:publicId",
			new ValidationMiddleware({ params: publicIdSchema }).validate(),
			this.userController.likeActionByPublicId,
		);

		// Account deletion
		this.router.delete("/me", this.userController.deleteMyAccount);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
