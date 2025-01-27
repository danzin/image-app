import { Model, ClientSession } from 'mongoose';
import { UserRepository } from '../repositories/user.repository';
import { IUser, PaginationOptions, PaginationResult } from '../types';
import  CloudinaryService  from './cloudinary.service';
import { ImageRepository } from '../repositories/image.repository';
import { createError } from '../utils/errors';
import jwt from 'jsonwebtoken';

export class UserService {
  private userRepository: UserRepository;
  private cloudinaryService: CloudinaryService;
  private imageRepository: ImageRepository;
  private userModel: Model<IUser>;

  constructor(
    userModel: Model<IUser>,
    imageRepository: ImageRepository,
    cloudinaryService: CloudinaryService
  ) {
    this.userModel = userModel;
    this.userRepository = new UserRepository(userModel);
    this.imageRepository = imageRepository;
    this.cloudinaryService = cloudinaryService;
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
    const session = await this.userModel.startSession();
    session.startTransaction();

    try {
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

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw createError(error.name, error.message);
    } finally {
      session.endSession();
    }
  }

  async updateCover(userId: string, file: Buffer): Promise<void> {
    const session = await this.userModel.startSession();
    session.startTransaction();

    try {
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

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw createError(error.name, error.message);
    } finally {
      session.endSession();
    }
  }

  async deleteUser(id: string): Promise<void> {
    const session = await this.userModel.startSession();
    session.startTransaction();

    try {
      const user = await this.userRepository.findById(id, session);
      if (!user) {
        throw createError('NotFoundError', 'User not found');
      }

      const cloudResult = await this.cloudinaryService.deleteMany(user.username);
      if (cloudResult.result !== 'ok') {
        throw createError('CloudinaryError', cloudResult.message || 'Error deleting cloudinary data');
      }

      await this.imageRepository.deleteMany(id, session);
      await this.userRepository.delete(id, session);
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw createError(error.name, error.message);
    } finally {
      session.endSession();
    }
  }

  async getUserById(id: string): Promise<IUser> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw createError('NotFoundError', 'User not found');
    }
    return user;
  }

  async getUsers(options: PaginationOptions): Promise<PaginationResult<IUser>> {
    return await this.userRepository.findWithPagination(options);
  }
}