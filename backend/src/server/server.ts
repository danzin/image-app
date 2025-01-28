// src/server/server.ts
import 'reflect-metadata';
import express, { Application } from 'express';
import { injectable, inject } from 'tsyringe';
import { UserRoutes } from '../routes/user.routes';
import { ImageRoutes } from '../routes/image.routes';
import { ErrorHandler } from '../utils/errors';

@injectable()
export class Server {
  private app: Application;

  constructor(
    @inject(UserRoutes) private readonly userRoutes: UserRoutes,
    @inject(ImageRoutes) private readonly imageRoutes: ImageRoutes
  ) {

    this.app = express();
    this.initializeMiddlewares();
    this.initializeRoutes();
  this.initializeErrorHandling()
  }

  private initializeMiddlewares(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
  }

  private initializeRoutes() {
    this.app.use('/api/users', this.userRoutes.getRouter());
    this.app.use('/api/images', this.imageRoutes.getRouter());
  }

  private initializeErrorHandling() {
    this.app.use(ErrorHandler.handleError);
  }

  public start(port: number): void {
    this.app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  }
}