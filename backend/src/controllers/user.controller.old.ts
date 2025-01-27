import { Request, Response, NextFunction } from 'express';
import { Model } from 'mongoose';
import { UserService } from '../services/user.service';
import { ImageRepository } from '../repositories/image.repository';
import { IUser, PaginationOptions } from '../types';
import {CloudinaryService} from '../services/cloudinary.service';
import { createError } from '../utils/errors';

export class UserController {
  private userService: UserService;

  constructor(
    userModel: Model<IUser>,
    imageModel: Model<any>, // Replace 'any' with your image interface
  ) {
    const imageRepository = new ImageRepository(imageModel);
    const cloudinaryService = new CloudinaryService();
    this.userService = new UserService(userModel, imageRepository, cloudinaryService);
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user, token } = await this.userService.register(req.validatedBody);
      res.status(201).json({
        email: user.email,
        username: user.username,
        token
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.validatedBody;
      const { user, token } = await this.userService.login(email, password);
      res.status(201).json({ user, token });
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { decodedUser } = req;
      const user = await this.userService.getUserById(decodedUser.id);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(id);
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const options: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc'
      };

      const users = await this.userService.getUsers(options);
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { validatedBody, decodedUser } = req;
      const updatedUser = await this.userService.updateProfile(decodedUser.id, validatedBody);
      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  };

  updateAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { decodedUser, file } = req;
      if (!file) {
        throw createError('ValidationError', 'No file provided');
      }
      await this.userService.updateAvatar(decodedUser.id, file.buffer);
      res.status(200).json({ message: 'Avatar updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  updateCover = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { decodedUser, file } = req;
      if (!file) {
        throw createError('ValidationError', 'No file provided');
      }
      await this.userService.updateCover(decodedUser.id, file.buffer);
      res.status(200).json({ message: 'Cover image updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { decodedUser } = req;
      if (decodedUser.id !== id) {
        throw createError('UnauthorizedError', 'You are not authorized to perform this action');
      }
      await this.userService.deleteUser(id);
      res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  // Follow/Unfollow functionality would need to be implemented in the service first
  followUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId: followeeId } = req.params;
      const { decodedUser } = req;
      // You'll need to implement this in the service
      // await this.userService.followUser(decodedUser.id, followeeId);
      res.status(200).json({ message: 'Followed successfully.' });
    } catch (error) {
      next(error);
    }
  };

  unfollowUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId: followeeId } = req.params;
      const { decodedUser } = req;
      // You'll need to implement this in the service
      // await this.userService.unfollowUser(decodedUser.id, followeeId);
      res.status(200).json({ message: 'Unfollowed successfully.' });
    } catch (error) {
      next(error);
    }
  };
}