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
@injectable()
export class Server {
  private app: Application;

  constructor(
    @inject(UserRoutes) private readonly userRoutes: UserRoutes,
    @inject(ImageRoutes) private readonly imageRoutes: ImageRoutes,
    @inject(SearchRoutes) private readonly searchRoutes: SearchRoutes,
    @inject(AdminUserRoutes) private readonly adminUserRoutes: AdminUserRoutes,
    @inject(NotificationRoutes) private readonly notificationRoutes: NotificationRoutes
  ) {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    //use cookies
    this.app.use(cookieParser());
    //parse json
    this.app.use(express.json());
    //handle url-encoded payloads 
    this.app.use(express.urlencoded({ extended: true }));

    //loggers
    this.app.use(logBehaviour); // Logs basic request/response info
    this.app.use(detailedRequestLogging); // Logs detailed request info
    
  
  }

  private initializeRoutes() {
    console.log('server initing routes')
    this.app.use('/api/users', this.userRoutes.getRouter());
    this.app.use('/api/images', this.imageRoutes.getRouter());
    this.app.use('/api/search', this.searchRoutes.getRouter());
    this.app.use('/api/admin', this.adminUserRoutes.getRouter());
    this.app.use('/api/notifications/', this.notificationRoutes.getRouter());
    // this.app.use('/api/follows', this.followRouter.getRouters());
   
  }

  private initializeErrorHandling() {
 
    this.app.use(ErrorHandler.handleError);
  }

  public getExpressApp(): Application {
    return this.app;
  }

  //setting the http server
  public start(server: http.Server, port: number): void {
    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}
