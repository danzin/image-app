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


  async followUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId: followeeId } = req.params; // ID of user to follow(followee)
      const { decodedUser } = req; // Logged in user is the follower

      await this.userService.followUser(decodedUser.id, followeeId);
      res.status(200).json({ message: 'Followed successfully.' });
    } catch (error) {
      next(error);
    }
  }

  
  async unfollowUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId: followeeId } = req.params; 
      const { decodedUser } = req; 

      await this.userService.unfollowUser(decodedUser.id, followeeId);
      res.status(200).json({ message: 'Unfollowed successfully.' });
    } catch (error) {
      next(error);
    }
  }



  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params
      const user = await this.userService.getUserById(id);
      console.log(`user is getUser from userController: ${user}`)
      if(!user){
        throw createError('PathError', 'User not found');
      }
      res.json(user);
    } catch (error) {
      next(error)
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

  async updateAvatar(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const { decodedUser, file } = req;
      console.log(file)
      await this.userService.updateAvatar(decodedUser.id, file.buffer);
      res.status(200).end();
    } catch (error) {
      next(error);
    }
  }

  async updateCover(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const { decodedUser, file } = req;
      console.log(file)
      await this.userService.updateCover(decodedUser.id, file.buffer);
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

  // async searchUser(req: Request, res: Response, next: NextFunction): Promise<void>{
  //   try {
  //     const { username } = req.query;
  //     if (!username) {
  //       res.status(400).json({ success: false, message: 'Query is required' });
  //     }
  //     const user = await this.userService.searchUser(username as string);
  //     res.json({success: true, data: user});
  //   } catch (error) {
      
  //   }

  // }

}