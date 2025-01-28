// controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { createError } from '../utils/errors';
import { injectable, inject } from 'tsyringe';

/**  
 * When using Dependency Injection in Express, there's a common
 * issue with route handles and `this` binding. When Express calls the route handlers,
 * it changes the context of `this`. So when I initialize the dependncy inside the constructor
 * like this.userService = userService, `this` context is lost and this.userService is undefined.
 * 
 * 2 possible fixes: 
 *  1 - manually bind all methods that will be used as route handlers:
 *     - this.register = this.register.bind(this);
 *     - etc etc, for every single method
 *  2 - user arrow functions, which automatically bind `this` and it doesn't get lost. 
 */

@injectable()
export class UserController {
  constructor(
    @inject('UserService') private readonly userService: UserService
  ) {}


  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { user, token } = await this.userService.register(req.body);
      res.status(201).json({ user, token });
    } catch (error) {
      next(error);
    }
  }

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const { user, token } = await this.userService.login(email, password);
      res.status(200).json({ user, token });
    } catch (error) {
      next(error);
    }
  }

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const updatedUser = await this.userService.updateProfile(req.params.id, req.body);
      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }

  updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const file = req.file?.buffer;
      if (!file) throw createError('ValidationError', 'No file provided');
      await this.userService.updateAvatar(req.params.userId, file);
      res.status(200).json({ message: 'Avatar updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  deleteUser = async(req: Request, res: Response, next: NextFunction) => {
    try {
      await this.userService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  getUserById = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.getUserById(req.params.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  getUsers = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const options = { ...req.query } as any;
      const result = await this.userService.getUsers(options);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}