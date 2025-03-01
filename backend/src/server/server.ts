import 'reflect-metadata';
import express, { Application } from 'express';
import cookieParser from 'cookie-parser'
import http from 'http';  
import { injectable, inject } from 'tsyringe';
import { UserRoutes } from '../routes/user.routes';
import { ImageRoutes } from '../routes/image.routes';
import { createError, ErrorHandler } from '../utils/errors';
import { SearchRoutes } from '../routes/search.routes';
import { AdminUserRoutes } from '../routes/admin.routes';
import { detailedRequestLogging, logBehaviour } from '../middleware/logMiddleware';
import { NotificationRoutes } from '../routes/notification.routes';
import { FeedRoutes } from '../routes/feed.routes';
import path from 'path';
@injectable()
export class Server {
  private app: Application;

   /**
   * Constructor for initializing the server with injected dependencies.
   * @param {UserRoutes} userRoutes - Routes for user-related endpoints.
   * @param {ImageRoutes} imageRoutes - Routes for image-related endpoints.
   * @param {SearchRoutes} searchRoutes - Routes for search-related endpoints.
   * @param {AdminUserRoutes} adminUserRoutes - Routes for admin-related endpoints.
   * @param {NotificationRoutes} notificationRoutes - Routes for notifications.
   * @param {FeedRoutes} feedRoutes - Routes for managing user feeds.
   */
  constructor(
    @inject(UserRoutes) private readonly userRoutes: UserRoutes,
    @inject(ImageRoutes) private readonly imageRoutes: ImageRoutes,
    @inject(SearchRoutes) private readonly searchRoutes: SearchRoutes,
    @inject(AdminUserRoutes) private readonly adminUserRoutes: AdminUserRoutes,
    @inject(NotificationRoutes) private readonly notificationRoutes: NotificationRoutes,
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
    this.app.use(cookieParser()); // Parsing cookies
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
    console.log('server initing routes')
    this.app.use('/api/users', this.userRoutes.getRouter());
    this.app.use('/api/images', this.imageRoutes.getRouter());
    this.app.use('/api/search', this.searchRoutes.getRouter());
    this.app.use('/api/admin', this.adminUserRoutes.getRouter());
    this.app.use('/api/notifications/', this.notificationRoutes.getRouter());
    this.app.use('/api/feed', this.feedRoutes.getRouter());

    // Serves uploaded files from the "uploads" directory
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
   
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
