import express from "express";
import { asyncHandler } from '@/middleware/async-handler.middleware';
import { AdminUserController } from "../controllers/admin.controller";
import { adminRateLimit, AuthFactory, enhancedAdminOnly } from "../middleware/authentication.middleware";
import { inject, injectable } from "tsyringe";

@injectable()
export class AdminUserRoutes {
	private router: express.Router;
	private auth = AuthFactory.bearerToken().handle();

	constructor(@inject("AdminUserController") private readonly adminUserController: AdminUserController) {
		this.router = express.Router();
		this.initializeRoutes();
	}

	private initializeRoutes(): void {
		this.router.use(this.auth);
		this.router.use(adminRateLimit);
		this.router.use(enhancedAdminOnly);

		// ===Admin endpoints===

		//Get all users
		this.router.get("/", asyncHandler(this.adminUserController.getAllUsersAdmin));

		//Get user by public ID
		this.router.get("/user/:publicId", asyncHandler(this.adminUserController.getUser));

		//Delete a user by public ID
		this.router.delete("/user/:publicId", asyncHandler(this.adminUserController.deleteUser));

		//Delete an image by public ID
		this.router.delete("/image/:publicId", asyncHandler(this.adminUserController.deleteImage));

		//Delete a comment by ID
		this.router.delete("/comment/:commentId", asyncHandler(this.adminUserController.deleteComment));

		//Remove a favorite from a user
		this.router.delete("/user/:publicId/favorite/:postPublicId", asyncHandler(this.adminUserController.removeUserFavorite));

		// ===New Admin endpoints===

		// User management
		this.router.get("/user/:publicId/stats", asyncHandler(this.adminUserController.getUserStats));
		this.router.put("/user/:publicId/ban", asyncHandler(this.adminUserController.banUser));
		this.router.put("/user/:publicId/unban", asyncHandler(this.adminUserController.unbanUser));
		this.router.put("/user/:publicId/promote", asyncHandler(this.adminUserController.promoteToAdmin));
		this.router.put("/user/:publicId/demote", asyncHandler(this.adminUserController.demoteFromAdmin));

		// Image management
		this.router.get("/images", asyncHandler(this.adminUserController.getAllImages));

		// Dashboard and analytics
		this.router.get("/dashboard/stats", asyncHandler(this.adminUserController.getDashboardStats));
		this.router.get("/dashboard/activity", asyncHandler(this.adminUserController.getRecentActivity));
		this.router.get("/dashboard/request-logs", asyncHandler(this.adminUserController.getRequestLogs));

		// Cache management
		this.router.delete("/cache", asyncHandler(this.adminUserController.clearCache));
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
