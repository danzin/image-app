import express from "express";
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
		this.router.get("/", this.adminUserController.getAllUsersAdmin);

		//Get user by public ID
		this.router.get("/user/:publicId", this.adminUserController.getUser);

		//Delete a user by public ID
		this.router.delete("/user/:publicId", this.adminUserController.deleteUser);

		//Delete an image by public ID
		this.router.delete("/image/:publicId", this.adminUserController.deleteImage);

		// ===New Admin endpoints===

		// User management
		this.router.get("/user/:publicId/stats", this.adminUserController.getUserStats);
		this.router.put("/user/:publicId/ban", this.adminUserController.banUser);
		this.router.put("/user/:publicId/unban", this.adminUserController.unbanUser);
		this.router.put("/user/:publicId/promote", this.adminUserController.promoteToAdmin);
		this.router.put("/user/:publicId/demote", this.adminUserController.demoteFromAdmin);

		// Image management
		this.router.get("/images", this.adminUserController.getAllImages);

		// Dashboard and analytics
		this.router.get("/dashboard/stats", this.adminUserController.getDashboardStats);
		this.router.get("/dashboard/activity", this.adminUserController.getRecentActivity);

		// Cache management
		this.router.delete("/cache", this.adminUserController.clearCache);
	}

	public getRouter(): express.Router {
		return this.router;
	}
}
