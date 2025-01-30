import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { createError } from '../utils/errors';
import { injectable, inject } from 'tsyringe';
import { FollowService } from '../services/follow.service';

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
    @inject('UserService') private readonly userService: UserService,
    @inject('FollowService') private readonly followService: FollowService
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
      const {decodedUser} = req;  
      console.log(decodedUser)
      const updatedUser = await this.userService.updateProfile(decodedUser.id, req.body);
      res.status(200).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }

  updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;
      const file = req.file?.buffer;
      if (!file) throw createError('ValidationError', 'No file provided');
      await this.userService.updateAvatar(decodedUser.id, file);
      res.status(200).json({ message: 'Avatar updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  deleteUser = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;

      await this.userService.deleteUser(decodedUser.id);
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

  likeAction = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;
      const {imageId} = req.params;
      console.log(imageId)
      const result = await this.userService.likeAction(decodedUser.id, imageId)
      res.status(200).json(result)
    } catch (error) {
      
    }
  }


  //will be reworked as followAction and toggle between follow/unfollow based on current follow status
  // followUser = async (req: Request, res: Response) => {
  //   const {decodedUser} = req;

  //   const {targetUserId } = req.params;
  //   const result = await this.followService.followUser(decodedUser.id, targetUserId);
  //   res.status(200).json(result ? { message: result } : { message: 'Successfully followed user' });
  // }
  
  // unfollowUser = async (req: Request, res: Response) => {
  //   const {decodedUser} = req;

  //   const { targetUserId } = req.params;

  //   const result = await this.followService.unfollowUser(decodedUser.id, targetUserId);
 
  //   res.status(200).json(result ? { message: result } : { message: 'Successfully unfollowed user' } );
  // }
}