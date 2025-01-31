import express from 'express';
import { UserController } from '../controllers/user.controller';
import { AuthFactory } from '../middleware/authentication.middleware';
import { ValidationMiddleware } from '../middleware/validation.middleware';
import upload from '../config/multer';
import { UserSchemas, UserValidationSchemas } from '../utils/schemals/user.schemas';
import { inject, injectable } from 'tsyringe';



@injectable()
export class UserRoutes {
  private router: express.Router;
  private auth = AuthFactory.bearerToken().handle();

  constructor(
    @inject('UserController') private readonly userController: UserController
  ) {
    this.router = express.Router();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    // Public routes
    this.router.post(
      '/register',
      new ValidationMiddleware({ body: UserSchemas.registration() }).validate(),
      this.userController.register
    );

    this.router.post(
      '/login',
      new ValidationMiddleware({ body: UserSchemas.login() }).validate(),
      this.userController.login
    );

    this.router.get('/', this.userController.getUsers);
    this.router.get('/:id', this.userController.getUserById);
    

    // Protected routes group
    const protectedRouter = express.Router();
    this.router.use(protectedRouter); 
    protectedRouter.use(this.auth);

    protectedRouter.put(
      '/edit',
      this.userController.updateProfile
    );

    protectedRouter.post(
      '/follow/:followeeId',
      this.userController.followAction
    )

    protectedRouter.post(
      '/like/:imageId',
      this.userController.likeAction
    )


    protectedRouter.put(
      '/:id/avatar',
      upload.single('avatar'),
      this.userController.updateAvatar
    );

  

    protectedRouter.delete(
      '/:id',
      this.userController.deleteUser
    );

  }

  public getRouter(): express.Router {
    return this.router;
  }
}