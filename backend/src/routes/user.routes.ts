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

    this.router.post('/logout', this.userController.logout);
    
    this.router.get('/users', this.userController.getUsers);

    this.router.get('/me', this.auth, this.userController.getMe);
    this.router.put('/edit', this.auth, this.userController.updateProfile);
    this.router.post('/follow/:followeeId', this.auth, this.userController.followAction);
    this.router.get('/follows/:followeeId', this.auth, this.userController.followExists);
    this.router.post('/like/:imageId', this.auth, this.userController.likeAction);
    this.router.put(
      '/avatar',
      this.auth,
      upload.single('avatar'),
      this.userController.updateAvatar
    );
    this.router.put(
      '/cover',
      this.auth,
      upload.single('cover'),
      this.userController.updateCover
    );

    this.router.delete('/:id', this.auth, this.userController.deleteUser);

    this.router.get('/:userId', this.userController.getUserById);
  }

  public getRouter(): express.Router {
      return this.router;
  }
}