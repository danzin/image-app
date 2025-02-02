import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { injectable, inject } from 'tsyringe';
import { ImageService } from '../services/image.service';
import { IUser } from '../types';

@injectable()
export class AdminUserController {
  constructor(
    @inject('UserService') private readonly userService: UserService,
    @inject('ImageService') private readonly imageService: ImageService,

  ) {}

  getAllUsersAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const options = { ...req.query } as any;
      const result = await this.userService.getAllUsersAdmin(options);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;
      const {id} = req.params;
      const result = await this.userService.getUserById(id, decodedUser as IUser)
      res.status(200).json(result);
    } catch (error) {
      next(error)
    }
  }

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.userService.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  deleteImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.imageService.deleteImage(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };


}
