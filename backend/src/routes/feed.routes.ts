import { FeedController } from '../controllers/feed.controller';
import express from 'express';
import { AuthFactory } from '../middleware/authentication.middleware';
import { inject, injectable } from 'tsyringe';

@injectable()
export class FeedRoutes {
  public router: express.Router
  private auth = AuthFactory.bearerToken().handle();

  constructor(@inject('FeedController') private controller: FeedController){
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get('/', this.auth, this.controller.getFeed);
  }

  public getRouter(): express.Router {
    return this.router;
  }

}