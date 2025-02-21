import { Model, ClientSession } from 'mongoose';
import { UserRepository } from '../repositories/user.repository';
import { IImage, IUser, PaginationOptions, PaginationResult } from '../types';
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
import { UserDTOService } from './dto.service';
import { AdminUserDTO, PublicUserDTO } from '../types';
import { FeedService } from './feed.service';

/**
 * UserService handles all user-related operations, including authentication, profile updates, 
 * and interactions such as following and liking images.
 */
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
    @inject('NotificationService') private readonly notificationService: NotificationService,
    @inject('FeedService') private readonly feedService: FeedService,
    @inject('UserDTOService') private readonly dtoService: UserDTOService,
  ) {
    
  }

  /**
   * Generates a JWT token for a user.
   * @param user - The user object
   * @returns A signed JWT token
   */
  private generateToken(user: IUser): string {
    const payload = { id: user._id, email: user.email, username: user.username, isAdmin: user.isAdmin };
    const secret = process.env.JWT_SECRET;
    if (!secret) throw createError('ConfigError', 'JWT secret is not configured');
    
    return jwt.sign(payload, secret, { expiresIn: '12h' });
  }

  /**
   * Registers a new user and returns the user DTO along with an authentication token.
   * @param userData - Partial user data
   * @returns The created user and authentication token
   */
  async register(userData: Partial<IUser>): Promise<{ user: PublicUserDTO; token: string }> {
    try {
      const user = await this.userRepository.create(userData);
      const token = this.generateToken(user);
      
      // New users always get public DTO
      const userDTO = this.dtoService.toPublicDTO(user);
      
      return { user: userDTO, token };
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }


   /**
   * Authenticates a user and returns their data along with a token.
   * @param email - User's email
   * @param password - User's password
   * @returns The authenticated user and token
   */
  async login(email: string, password: string): Promise<{ user: PublicUserDTO | AdminUserDTO; token: string }> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user || !(await user.comparePassword?.(password))) {
        throw createError('AuthenticationError', 'Invalid email or password');
      }

      const token = this.generateToken(user);
      
      // Assign appropriate DTO
      const userDTO = user.isAdmin 
        ? this.dtoService.toAdminDTO(user)
        : this.dtoService.toPublicDTO(user);

      return { user: userDTO, token };
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  /**
   * Retrieves the authenticated user's profile.
   * @param user - The user object (partial).
   * @returns The user's updated profile (DTO) and a refreshed token.
   */
  async getMe(user: Partial<IUser>): Promise<{ user: PublicUserDTO; token: string }> {
    try {
      const freshUser = await this.userRepository.findById(user.id as string);
      if (!freshUser) {
        throw createError('PathError', 'User not found');
      }

      const token = this.generateToken(freshUser);
      return { user: this.dtoService.toPublicDTO(freshUser), token };
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  /**
   * Updates a user's profile information.
   * @param id - The ID of the user being updated.
   * @param userData - The new user data.
   * @param requestingUser - The user making the request.
   * @returns The updated user (DTO).
   */
  async updateProfile(id: string, userData: Partial<IUser>, requestingUser: IUser): Promise<PublicUserDTO | AdminUserDTO> {
    try {
      let updatedUser: IUser = null;
      await this.unitOfWork.executeInTransaction(async (session) => {
        updatedUser = await this.userRepository.update(id, userData);
        if (!updatedUser) {
          throw createError('NotFoundError', 'User not found');
        }
        await this.userActionRepository.logAction(id, 'User data update', id, session);
      });
  
      return requestingUser.isAdmin 
        ? this.dtoService.toAdminDTO(updatedUser) 
        : this.dtoService.toPublicDTO(updatedUser);
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  /**
   * Updates a user's avatar image.
   * @param userId - The ID of the user updating their avatar.
   * @param file - The new avatar image file.
   */
  async updateAvatar(userId: string, file: Buffer): Promise<void> {
    try {
      await this.unitOfWork.executeInTransaction(async (session) => {
      const user = await this.userRepository.findById(userId, session);
      if (!user) {
        throw createError('NotFoundError', 'User not found');
      }

      const oldAvatarUrl = user.avatar;
      const cloudImage = await this.cloudinaryService.uploadImage(file, user.username);
      
      await this.userRepository.updateAvatar(userId, cloudImage.url, session);
      
      if (oldAvatarUrl) {
        await this.cloudinaryService.deleteAssetByUrl(userId, oldAvatarUrl);
      }
    })
    } catch (error) {
      throw createError(error.name, error.message);
    } 
  }

  /**
   * Updates a user's cover image.
   * @param userId - The ID of the user updating their cover.
   * @param file - The new cover image file.
   */
  async updateCover(userId: string, file: Buffer): Promise<void> {
    try {
      await this.unitOfWork.executeInTransaction(async (session) => {
        const user = await this.userRepository.findById(userId, session);
        if (!user) {
          throw createError('NotFoundError', 'User not found');
        }

        const oldCoverUrl = user.cover;
        const cloudImage = await this.cloudinaryService.uploadImage(file, user.username);
        
        await this.userRepository.updateCover(userId, cloudImage.url, session);

        if (oldCoverUrl) {
          await this.cloudinaryService.deleteAssetByUrl(userId, oldCoverUrl);
        }
    })
    } catch (error) {
      throw createError(error.name, error.message);
    } 
  }

  /**
   * Deletes a user from the system.
   * @param id - The ID of the user to be deleted.
   * @throws NotFoundError if the user is not found.
   */
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

  /**
   * Retrieves a user by ID.
   * If the requesting user is an admin, it returns an admin DTO; otherwise, it returns a public DTO.
   * @param id - The ID of the user to retrieve.
   * @param requestingUser - (Optional) The user making the request (used to determine admin privileges).
   * @returns The user's data in either admin or public DTO format.
   * @throws NotFoundError if the user is not found.
   */
  async getUserById(id: string, requestingUser?: IUser): Promise<PublicUserDTO | AdminUserDTO> {
    try {
      const user = await this.userRepository.findById(id);
      if (!user) {
        throw createError('NotFoundError', 'User not found');
      }
  
      // Return admin DTO if requesting user is admin
      if(requestingUser?.isAdmin) {
        return this.dtoService.toAdminDTO(user);
      }
      return this.dtoService.toPublicDTO(user);
      
    } catch (error) {
      throw createError(error.name, error.message)
    }
  }

  /**
   * Retrieves a paginated list of users.
   * Converts user data into public DTO format before returning.
   * @param options - Pagination options (page number, limit, sorting).
   * @returns A paginated result containing users in public DTO format.
   */
  async getUsers(options: PaginationOptions): Promise<PaginationResult<PublicUserDTO>> {
    const result = await this.userRepository.findWithPagination(options);
    
    return {
      data: result.data.map(user => this.dtoService.toPublicDTO(user)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    };
  }


  /**
   * Handles user "like" or "unlike" actions on an image.
   * If the user has already liked the image, it removes the like.
   * Otherwise, it adds a like and triggers a notification.
   * @param userId - The ID of the user performing the action.
   * @param imageId - The ID of the image being liked/unliked.
   * @throws PathError if the image is not found.
   * @throws TransactionError if the database transaction fails.
   */
  async likeAction(userId: string, imageId: string): Promise<IImage> { 
    let isLikeAction = true; // Track if this is a like or unlike
    let imageTags: string[] = []; // Stroe image tags for the feed service

    try {
      // Check if image exists before starting transaction
    const existingImage = await this.imageRepository.findById(imageId);
    if (!existingImage) {
        throw createError('PathError', `Image with id ${imageId} not found`);
    }
    imageTags = existingImage.tags.map(tag => tag.tag);

    await this.unitOfWork.executeInTransaction(async (session) => {
        const existingLike = await this.likeRepository.findByUserAndImage(userId, imageId, session);
        
        if (existingLike) {
            // Unlike flow
            isLikeAction = false;
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
          await this.notificationService.createNotification({
              receiverId: existingImage.user.id.toString(),
              actionType: "like",
              actorId: userId,
              targetId: imageId,
              session
          });
        }
    });

      // Updating feed preference, not awaiting this to not block the response 
      this.feedService.recordInteraction(
        userId,
        isLikeAction ? 'like' : 'unlike',
        imageId,
        imageTags
      ).catch(error => {
        // Log error but don't fail the request
        console.error('Failed to record feed interaction:', error);
      });

    //Return the updated image
    return this.imageRepository.findById(imageId);

    } catch (error) {
      if (error.name === 'PathError') {
        throw createError('PathError', error.message); 
      }
      throw createError('TransactionError', error.message, {
        function: 'likeAction',
        additionalInfo: 'Transaction failed',
        originalError: error
      });
     
    }
   
}

  /**
   * Handles user "follow" or "unfollow" actions.
   * If the user is already following the target user, it removes the follow.
   * Otherwise, it adds a follow and triggers a notification.
   * @param followerId - The ID of the user initiating the action.
   * @param followeeId - The ID of the user being followed/unfollowed.
   * @throws TransactionError if the database transaction fails.
   */
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
          );
          
        }
      });
    } catch (error) {
      throw createError('TransactionError', error.message, {
        function: 'likeAction',
        additionalInfo: 'Transaction failed',
        originalError: error
      });
    }
    
  }

  /**
 * Retrieves a paginated list of all users, including admin details.
 * Converts user data into admin DTO format before returning.
 * @param options - Pagination options (page number, limit, sorting).
 * @returns A paginated result containing users in admin DTO format.
 */
  async getAllUsersAdmin(options: PaginationOptions): Promise<PaginationResult<AdminUserDTO>> {
    const result = await this.userRepository.findWithPagination(options);
    
    return {
      data: result.data.map(user => this.dtoService.toAdminDTO(user)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages
    };
  }

  
}