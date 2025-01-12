import express from 'express';
import { UserController } from '../controllers/user.controller'
import { UserEditValidation, UserLoginValidation, UserRegistrationValidation, ValidationMiddleware } from '../middleware/validation.middleware';
import { AuthentitactionMiddleware } from '../middleware/authorization.middleware';

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
    this.router.get('/', this.userController.getUsers.bind(this.userController));
    this.router.get('/me', AuthentitactionMiddleware.auth, this.userController.getMe.bind(this.userController));
    this.router.delete('/dropUsers', this.userController.dropUsers.bind(this.userController));
    this.router.post('/login',
      ValidationMiddleware.validate(new UserLoginValidation()),
      this.userController.login.bind(this.userController));
    this.router.post('/edit',
      AuthentitactionMiddleware.auth,
      ValidationMiddleware.validate(new UserEditValidation()),
      this.userController.updateUser.bind(this.userController)),
      this.router.delete('/delete/:id', AuthentitactionMiddleware.auth, this.userController.deleteUser.bind((this.userController)));

    }

}