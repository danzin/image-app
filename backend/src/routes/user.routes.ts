import express from 'express';
import { UserController } from '../controllers/user.controller'
import { UserEditValidation, UserLoginValidation, UserRegistrationValidation, ValidationMiddleware } from '../middleware/validation.middleware';
import { AuthentitactionMiddleware } from '../middleware/authorization.middleware';
import upload from '../config/multer';

export class UserRoutes {
  public router: express.Router;
  private userController: UserController;

  constructor() {
    this.router = express.Router();
    this.userController = new UserController();
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.post('/register', 
      ValidationMiddleware.validate(new UserRegistrationValidation()),
      this.userController.register.bind(this.userController)
    );
    //all users
    this.router.get('/', this.userController.getUsers.bind(this.userController));

    //curently logged in user
    this.router.get('/me', AuthentitactionMiddleware.auth, this.userController.getMe.bind(this.userController));
    
    //drop all user documents
    this.router.delete('/dropUsers', this.userController.dropUsers.bind(this.userController));
    
    this.router.post('/login',
      ValidationMiddleware.validate(new UserLoginValidation()),
      this.userController.login.bind(this.userController));
    
      this.router.post('/edit',
      AuthentitactionMiddleware.auth,
      ValidationMiddleware.validate(new UserEditValidation()),
      this.userController.updateUser.bind(this.userController)),
    
    //update user avatar
    this.router.post('/avatar',
      AuthentitactionMiddleware.auth,
      upload.single('avatar'),
      this.userController.updateAvatar.bind(this.userController));

    //follow user
    this.router.post(
      '/follow/:userId',
      AuthentitactionMiddleware.auth, // Ensure the user is authenticated
      this.userController.followUser.bind(this.userController)
    );
  
    //unfollow user
    this.router.post(
      '/unfollow/:userId',
      AuthentitactionMiddleware.auth, // Ensure the user is authenticated
      this.userController.unfollowUser.bind(this.userController)
    );

    //update user cover
    this.router.post('/cover', 
      AuthentitactionMiddleware.auth,
      upload.single('cover'),
      this.userController.updateCover.bind(this.userController));

    //return specific user by id
    this.router.get('/:id', this.userController.getUser.bind(this.userController));

    //delete specific user by id
    this.router.delete('/:id', AuthentitactionMiddleware.auth, this.userController.deleteUser.bind((this.userController)));

    }

}