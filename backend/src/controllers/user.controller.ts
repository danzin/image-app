import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { createError } from '../utils/errors';
import { injectable, inject } from 'tsyringe';
import { FollowService } from '../services/follow.service';
import { IUser } from '../types';
import { cookieOptions } from '../config/cookieConfig';
import { CommandBus } from '../application/common/buses/command.bus';
import { QueryBus } from '../application/common/buses/query.bus';
import { RegisterUserCommand } from '../application/commands/users/register/register.command';
import { RegisterUserResult } from '../application/commands/users/register/register.handler';
import { GetMeQuery } from '../application/queries/users/getMe/getMe.query';
import { GetMeResult } from '../application/queries/users/getMe/getMe.handler';
import { LikeActionCommand } from '../application/commands/users/likeAction/likeAction.command';

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
    @inject('FollowService') private readonly followService: FollowService,
    @inject('CommandBus') private readonly commandBus: CommandBus,
    @inject('QueryBus') private readonly queryBus: QueryBus,
  ) {}


  //Register and login users 
  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { username, email, password } = req.body;
      const command = new RegisterUserCommand(username,email,password)
      const { user, token } = await this.commandBus.dispatch<RegisterUserResult>(command)
      res.cookie('token', token, cookieOptions);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  }

    // Refresh
    getMe = async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { decodedUser } = req;
        const query = new GetMeQuery(decodedUser.id);
        const { user, token } = await this.queryBus.execute<GetMeResult>(query);
        res.cookie('token', token, cookieOptions);
        res.status(200).json(user);
      } catch (error) {
        next(error);
      }
    };

   

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const { user, token } = await this.userService.login(email, password);
      res.cookie('token', token, cookieOptions);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }

  logout = async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.clearCookie('token');
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error)  
    }
  }



  // Profile updates
  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;  
      console.log(decodedUser)
      const updatedUser = await this.userService.updateProfile(decodedUser.id, req.body, decodedUser as IUser);
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

  updateCover = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;
      const file = req.file?.buffer;
      if (!file) throw createError('ValidationError', 'No file provided');
      await this.userService.updateCover(decodedUser.id, file);
      res.status(200).json({ message: 'Cover updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  // Delete user
  deleteUser = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;

      await this.userService.deleteUser(decodedUser.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  //User getters
  getUsers = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const options = { ...req.query } as any;
      const result = await this.userService.getUsers(options);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  getUserById = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedUser } = req
      const user = await this.userService.getUserById(req.params.userId, decodedUser as IUser);
      res.status(200).json(user);
    } catch (error) {
      next(error);
    }
  }
  
  // User actions
  likeAction = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;
      const {imageId} = req.params; 
      console.log(imageId)
      const command = new LikeActionCommand(decodedUser.id, imageId)
      const result = await this.commandBus.dispatch(command)
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  }
  
  followAction = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const {decodedUser} = req;
      const {followeeId} = req.params;
      console.log(followeeId)
      const result = await this.userService.followAction(decodedUser.id, followeeId)
      res.status(200).json(result)
    } catch (error) {
      next(error)
    }
  }

  followExists = async(req: Request, res: Response, next: NextFunction) => {
    try {
      const { decodedUser } = req;

      const followerId = decodedUser.id;
      const {followeeId} = req.params;

      const followExists = await this.followService.isFollowing(followerId, followeeId);
      res.status(200).json({isFollowing: followExists})
    } catch (error) {
      next(error)
    }
  }


  
}