// routes/user.routes.ts
import express from 'express';
import { UserController } from '../controllers/user.controller';
import { AuthFactory } from '../middleware/authentication.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import upload from '../config/multer';
import { UserSchemas, UserValidationSchemas } from '../utils/schemals/user.schemas';


export class UserRoutes {
  private router: express.Router;
  private auth = AuthFactory.bearerToken().handle();

  constructor(private controller: UserController) {
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Public routes
    this.router.post(
      '/register',
      new ValidationMiddleware({ body: UserSchemas.registration() }).validate(),
      this.controller.register
    );

    this.router.post(
      '/login',
      new ValidationMiddleware({ body: UserSchemas.login() }).validate(),
      this.controller.login
    );

    // Protected routes group
    const protectedRouter = express.Router();
    protectedRouter.use(this.auth);

    protectedRouter.put(
      '/:id/avatar',
      upload.single('avatar'),
      this.controller.updateAvatar
    );

    protectedRouter.delete(
      '/:id',
      this.controller.deleteUser
    );

    this.router.use('/protected', protectedRouter);
  }

  public getRouter(): express.Router {
    return this.router;
  }
}