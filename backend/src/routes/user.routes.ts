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

     // Protected routes group
     const protectedRouter = express.Router();
     this.router.use(protectedRouter); 
     protectedRouter.use(this.auth);
 
     protectedRouter.get(
       '/me',
       this.userController.getMe
     );

    this.router.get('/', this.userController.getUsers);
    this.router.get('/:id', this.userController.getUserById);

   

    protectedRouter.put(
      '/edit',
      this.userController.updateProfile
    );

    //logged in user follows another user
    protectedRouter.post(
      '/follow/:followeeId',
      this.userController.followAction
    )

    protectedRouter.get(
      '/follows/:followeeId', 
      this.userController.followExists
    )

    //logged in user likes an image
    protectedRouter.post(
      '/like/:imageId',
      this.userController.likeAction
    )

    //logged in update user avatar
    protectedRouter.put(
      '/avatar',
      upload.single('avatar'),
      this.userController.updateAvatar
    );

    //logged in user update cover
    protectedRouter.put(
      '/cover',
      upload.single('cover'),
      this.userController.updateCover
    );

  
    //logged in delete user
    //might need the userID for later use but for now it's reduntant. 
    protectedRouter.delete(
      '/:id',
      this.userController.deleteUser
    );

  }

  public getRouter(): express.Router {
    console.log('userRoute initialized')
    return this.router;
  }
}