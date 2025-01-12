import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { createError } from '../utils/errors';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await this.userService.registerUser(req.validatedBody);
      res.status(201).json({
        email: user.email,
        username: user.username
      });
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req: Request, res: Response, next: NextFunction): Promise<void>{
  try {
      const users = await this.userService.getUsers();
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }

  async dropUsers(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const result = await this.userService.drop();
      console.log(`Removed ${result} records.`)
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const { user, token } = await this.userService.login(req.validatedBody);
      res.status(201).json({user, token});
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const { validatedBody, decodedUser } = req;
      await this.userService.update(decodedUser.id, validatedBody);
      res.status(200).end();
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const { id } = req.params;
      const { decodedUser } = req;
      if(decodedUser.id !== id){
        throw createError('UnauthorizedError', 'You are not authorized to perform this action');
      }
      await this.userService.deleteUser(id);
      res.status(200).end();
    } catch (error) {
      next(error);
      
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const { decodedUser } = req;
      const user = await this.userService.getUserById(decodedUser.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

}