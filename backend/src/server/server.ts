import 'reflect-metadata';
import express, { Application } from 'express';
import http from 'http';  
import { injectable, inject } from 'tsyringe';
import { UserRoutes } from '../routes/user.routes';
import { ImageRoutes } from '../routes/image.routes';
import { ErrorHandler } from '../utils/errors';
import { SearchRoutes } from '../routes/search.routes';

@injectable()
export class Server {
  private app: Application;

  constructor(
    @inject(UserRoutes) private readonly userRoutes: UserRoutes,
    @inject(ImageRoutes) private readonly imageRoutes: ImageRoutes,
    @inject(SearchRoutes) private readonly searchRoutes: SearchRoutes
  ) {
    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private initializeMiddlewares(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeRoutes() {
    this.app.use('/api/users', this.userRoutes.getRouter());
    this.app.use('/api/images', this.imageRoutes.getRouter());
    this.app.use('/api/search', this.searchRoutes.getRouter());
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
