import "reflect-metadata";
import express, { Application } from "express";
import cookieParser from "cookie-parser";
import http from "http";
import { injectable, inject } from "tsyringe";
import { UserRoutes } from "../routes/user.routes";
import { ImageRoutes } from "../routes/image.routes";
import { CommentRoutes } from "../routes/comment.routes";
import { createError, ErrorHandler } from "../utils/errors";
import { SearchRoutes } from "../routes/search.routes";
import { AdminUserRoutes } from "../routes/admin.routes";
import { detailedRequestLogging, logBehaviour } from "../middleware/logMiddleware";
import { NotificationRoutes } from "../routes/notification.routes";
import { FeedRoutes } from "../routes/feed.routes";
import path from "path";
@injectable()
export class Server {
	private app: Application;

	/**
	 * Constructor for initializing the server with injected dependencies.
	 * @param {UserRoutes} userRoutes - Routes for user-related endpoints.
	 * @param {ImageRoutes} imageRoutes - Routes for image-related endpoints.
	 * @param {CommentRoutes} commentRoutes - Routes for comment-related endpoints.
	 * @param {SearchRoutes} searchRoutes - Routes for search-related endpoints.
	 * @param {AdminUserRoutes} adminUserRoutes - Routes for admin-related endpoints.
	 * @param {NotificationRoutes} notificationRoutes - Routes for notifications.
	 * @param {FeedRoutes} feedRoutes - Routes for managing user feeds.
	 */
	constructor(
		@inject(UserRoutes) private readonly userRoutes: UserRoutes,
		@inject(ImageRoutes) private readonly imageRoutes: ImageRoutes,
		@inject(CommentRoutes) private readonly commentRoutes: CommentRoutes,
		@inject(SearchRoutes) private readonly searchRoutes: SearchRoutes,
		@inject(AdminUserRoutes) private readonly adminUserRoutes: AdminUserRoutes,
		@inject(NotificationRoutes)
		private readonly notificationRoutes: NotificationRoutes,
		@inject(FeedRoutes) private readonly feedRoutes: FeedRoutes
	) {
		this.app = express(); // Initialize Express application
		this.initializeMiddlewares(); // Apply middleware configurations
		this.initializeRoutes(); // Register API routes
		this.initializeErrorHandling(); // Set up global error handling
	}

	/**
	 * Initializes middleware for the Express app.
	 */
	private initializeMiddlewares(): void {
		this.app.use((req, res, next) => {
			console.log(`[Backend] ${req.method} ${req.originalUrl}`);
			next();
		});
		this.app.use(cookieParser() as any); // Parsing cookies
		this.app.use(express.json()); // Parsing JSON request bodies
		this.app.use(express.urlencoded({ extended: true })); // Handling URL-encoded payloads

		// Loggers
		this.app.use(logBehaviour); // Logs basic request/response info
		this.app.use(detailedRequestLogging); // Logs detailed request info
	}

	/**
	 * Registers API routes with the Express app.
	 */
	private initializeRoutes() {
		const uploadsPath = path.join(process.cwd(), "uploads");
		console.log("Serving static uploads from:", uploadsPath);
		this.app.use("/uploads", express.static(uploadsPath));

		// Add health check endpoint
		this.app.get("/health", (req, res) => {
			res.status(200).json({
				status: "ok",
				timestamp: new Date().toISOString(),
				service: "backend",
			});
		});

		// Debug middleware to log all incoming requests
		this.app.use((req, res, next) => {
			console.log(`[Backend] ${req.method} ${req.path} - Headers:`, req.headers);
			next();
		});

		this.app.use("/users", this.userRoutes.getRouter());
		this.app.use("/images", this.imageRoutes.getRouter());
		this.app.use("/", this.commentRoutes.getRouter()); // Comments are nested under images and users
		this.app.use("/search", this.searchRoutes.getRouter());
		this.app.use("/admin", this.adminUserRoutes.getRouter());
		this.app.use("/notifications/", this.notificationRoutes.getRouter());
		this.app.use("/feed", this.feedRoutes.getRouter());

		// Catch-all route for debugging
		this.app.use("*", (req, res) => {
			console.log(`[Backend] 404 - Unmatched route: ${req.method} ${req.path}`);
			res.status(404).json({
				error: "Route not found",
				method: req.method,
				path: req.path,
				availableRoutes: [
					"/health",
					"/api/users",
					"/api/images",
					"/api/search",
					"/api/admin",
					"/api/notifications",
					"/api/feed",
				],
			});
		});
	}

	/**
	 * Sets up global error handling middleware.
	 * Any unhandled errors will be caught and formatted using the ErrorHandler.
	 */
	private initializeErrorHandling() {
		this.app.use(ErrorHandler.handleError);
	}

	/**
	 * Provides access to the Express application instance.
	 * @returns {Application} - The Express app instance.
	 */
	public getExpressApp(): Application {
		return this.app;
	}

	/**
	 * Starts the HTTP server on the specified port.
	 * @param {http.Server} server - The HTTP server instance.
	 * @param {number} port - The port number to listen on.
	 */
	public start(server: http.Server, port: number): void {
		server.listen(port, () => {
			console.log(`Server running on port ${port}`);
		});
	}
}
