import { Model, ClientSession } from 'mongoose';
import { UserRepository } from '../repositories/user.repository';
import { IUser, PaginationOptions, PaginationResult } from '../types';
import  {CloudinaryService}  from './cloudinary.service';
import { ImageRepository } from '../repositories/image.repository';
import { createError } from '../utils/errors';
import jwt from 'jsonwebtoken';
import { injectable, inject } from 'tsyringe';
import { UnitOfWork } from '../database/UnitOfWork';
import { LikeRepository } from '../repositories/like.repository';
import { FollowRepository } from '../repositories/follow.repository';
import { UserActionRepository } from '../repositories/userAction.repository';
import { convertToObjectId } from '../utils/helpers';
import { NotificationService } from './notification.service';
import { NotificationRepository } from '../repositories/notification.respository';
@injectable()
export class UserService {
  constructor(
    @inject('UserRepository') private readonly userRepository: UserRepository,
    @inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @inject('CloudinaryService') private readonly cloudinaryService: CloudinaryService,
    @inject('UserModel') private readonly userModel: Model<IUser>,
    @inject('UnitOfWork') private readonly unitOfWork: UnitOfWork,
    @inject('LikeRepository') private readonly likeRepository: LikeRepository,
    @inject('FollowRepository') private readonly followRepository: FollowRepository,
    @inject('UserActionRepository') private readonly userActionRepository: UserActionRepository,
    @inject('NotificationService') private readonly notificationService: NotificationService
  ) {
    
  }

  private generateToken(user: IUser): string {
    const payload = { id: user._id, email: user.email, username: user.username };
    const secret = process.env.JWT_SECRET;
    if (!secret) throw createError('ConfigError', 'JWT secret is not configured');
    
    return jwt.sign(payload, secret, { expiresIn: '6h' });
  }


  async register(userData: Partial<IUser>): Promise<{ user: IUser; token: string }> {
    try {
      const user = await this.userRepository.create(userData);
      const token = this.generateToken(user);
      return { user, token };
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user || !(await user.comparePassword?.(password))) {
        throw createError('AuthenticationError', 'Invalid email or password');
      }

      const token = this.generateToken(user);
      return { user, token };
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async updateProfile(id: string, userData: Partial<IUser>): Promise<IUser> {
    try {
      const updatedUser = await this.userRepository.update(id, userData);
      if (!updatedUser) {
        throw createError('NotFoundError', 'User not found');
      }
      return updatedUser;
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async updateAvatar(userId: string, file: Buffer): Promise<void> {
    try {
      await this.unitOfWork.executeInTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, session);
      if (!user) {
        throw createError('NotFoundError', 'User not found');
      }

      const oldAvatarUrl = user.avatar;
      const cloudImage = await this.cloudinaryService.uploadImage(file, userId);
      
      await this.userRepository.updateAvatar(userId, cloudImage.url, session);
      
      if (oldAvatarUrl) {
        await this.cloudinaryService.deleteAssetByUrl(userId, oldAvatarUrl);
      }
    })
    } catch (error) {
      throw createError(error.name, error.message);
    } 
  }

  //TODO: Finish this
  async updateCover(userId: string, file: Buffer): Promise<void> {
    try {
      await this.unitOfWork.executeInTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, session);
      if (!user) {
        throw createError('NotFoundError', 'User not found');
      }

      const oldCoverUrl = user.cover;
      const cloudImage = await this.cloudinaryService.uploadImage(file, userId);
      
      await this.userRepository.updateCover(userId, cloudImage.url, session);

      if (oldCoverUrl) {
        await this.cloudinaryService.deleteAssetByUrl(userId, oldCoverUrl);
      }
    })
    } catch (error) {
      throw createError(error.name, error.message);
    } 
  }

  async deleteUser(id: string): Promise<void> {
    try {
      await this.unitOfWork.executeInTransaction(async (session) => {   
      const user = await this.userRepository.findById(id, session);
      if (!user) {
        throw createError('NotFoundError', 'User not found');
      }

      if(user.images.length > 0 ){
        const cloudResult = await this.cloudinaryService.deleteMany(user.username);
        if (cloudResult.result !== 'ok' ) {
          throw createError('CloudinaryError', cloudResult.message || 'Error deleting cloudinary data');
        }
      }
     

      await this.imageRepository.deleteMany(id, session);
      await this.userRepository.delete(id, session);
    })
    } catch (error) {
    
      throw createError(error.name, error.message);
    } 
  
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw createError('PathError', 'User not found');
    }
    return user;
  }

  async getUsers(options: PaginationOptions): Promise<PaginationResult<IUser>> {
    return await this.userRepository.findWithPagination(options);
  }

  async likeAction(userId: string, imageId: string): Promise<void> {
  try {
   

    await this.unitOfWork.executeInTransaction(async (session) => {
      console.log(`running in this.unitOfWork.executeInTransaction`);
       // Check if image exists before starting transaction
    const existingImage = await this.imageRepository.findById(imageId);
    console.log(existingImage)
    if (!existingImage) {
      throw createError('PathError', `Image with id ${imageId} not found`);
    }
    
      const existingLike = await this.likeRepository.findByUserAndImage(userId, imageId, session);
      
      if (existingLike) {
        // Unlike flow
        await this.likeRepository.deleteLike(userId, imageId, session);
        await this.imageRepository.findOneAndUpdate(
          { _id: imageId },
          { $inc: { likes: -1 } },
          session
        );
        await this.userActionRepository.logAction(userId, "unlike", imageId, session);
    
      } else {
        // Like flow
        const userIdObject = convertToObjectId(userId);
        const imageIdObject = convertToObjectId(imageId);
        
        await this.likeRepository.create({ userId: userIdObject, imageId: imageIdObject }, session);
        await this.imageRepository.findOneAndUpdate(
          { _id: imageId },
          { $inc: { likes: 1 } },
          session
        );
        await this.userActionRepository.logAction(userId, "like", imageId, session);
        await this.notificationService.createNotification(
          {
            receiverId: existingImage.user.id.toString(),
            actionType: "like",
            actorId: userId,
            targetId: imageId,
            session
          },
        );
      }
    });
  } catch (error) {
    if (error.name === 'PathError') {
      throw error; 
    }
    throw createError('TransactionError', error.message, {
      function: 'likeAction',
      additionalInfo: 'Transaction failed',
      originalError: error
    });
  }
}

  
  async followAction(followerId: string, followeeId: string): Promise<void> {
  
    try {
      await this.unitOfWork.executeInTransaction(async (session) => {
        const isFollowing = await this.followRepository.isFollowing(followerId, followeeId);
    
        if (isFollowing) {
          // Unfollow logic
          await this.followRepository.removeFollow(followerId, followeeId, session);
          await this.userRepository.update(followerId, { $pull: { following: followeeId } }, session);
          await this.userRepository.update(followeeId, { $pull: { followers: followerId } }, session);
          await this.userActionRepository.logAction(followerId, "unfollow", followeeId, session);
        } else {
          // Follow logic
          await this.followRepository.addFollow(followerId, followeeId, session);
          await this.userRepository.update(followerId, { $addToSet: { following: followeeId } }, session);
          await this.userRepository.update(followeeId, { $addToSet: { followers: followerId } }, session);
          await this.userActionRepository.logAction(followerId, "follow", followeeId, session);
    

          
          // for now I'll emit the websocket event inside the transaction
          await this.notificationService.createNotification(
            {
              receiverId: followeeId,
              actionType: "follow",
              actorId: followerId,
              session
            },
             // Pass transaction session
          );
          
        }
      });
    } catch (error) {
      throw error;
    }
    
  }

  
}