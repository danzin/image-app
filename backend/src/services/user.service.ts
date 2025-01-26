import mongoose, { ClientSession } from 'mongoose';
import { UserRepository } from '../repositories/user.repository';
import { IUser } from '../types';
import { createError } from '../utils/errors';
import  CloudnaryService  from './cloudinary.service';

import jwt from 'jsonwebtoken';
import { ImageRepository } from '../repositories/image.repository';

export class UserService {
  private userRepository: UserRepository;
  private cloudinaryService: CloudnaryService;
  private imageRepository: ImageRepository;
  private generateToken(user: IUser): string{
  const payload = { id: user._id, email: user.email, username: user.username };
  const secret = process.env.JWT_SECRET;
  const options = {expiresIn: '6h'};
  
    return jwt.sign(payload, secret, options);
  }
  
  constructor() {
    this.userRepository = new UserRepository();
    this.cloudinaryService = new CloudnaryService();
    this.imageRepository = new ImageRepository();
  }

  async registerUser(userData: IUser): Promise<IUser> {
    try {  
      //Checks for uniqueness are handled and enforced by the database
      return await this.userRepository.create(userData);
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async followUser(followerId: string, followeeId: string): Promise<void> {
    try {
      if (followerId === followeeId) {
        throw createError('ValidationError', 'You cannot follow yourself.');
      }

      await this.userRepository.followUser(followerId, followeeId);
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async unfollowUser(followerId: string, followeeId: string): Promise<void> {
    try {
      await this.userRepository.unfollowUser(followerId, followeeId);
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }


  async login(userData: IUser): Promise<{user: IUser; token: string}> {
    try {
      const user = await this.userRepository.loginUser(userData.email, userData.password);

      if(!user){
        throw createError('AuthenticationError', 'Invalid email or password');
      }

      const token = this.generateToken(user);
      return { user, token };
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async getUsers(): Promise<IUser[]>{
    return await this.userRepository.getAll({});  
  }

  async drop(): Promise<Object>{
    return this.userRepository.deleteAll();
  }

  async update(id: string, userData: Partial<IUser>,): Promise<void>{
    try {
      for(let key in userData){
        if(userData[key] === ''){
          delete userData[key]
        }
      }
      const user = await this.userRepository.update(id, userData);
      if(!user){
        throw createError('ValidationError', 'User not found');
      }
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  //make sure old avatars are deleted froum cloudinary when user updates them
  // async updateAvatar(userId: string, file: Buffer): Promise<null> {
  //   let session: ClientSession | null = null;
  //   try {
  //     session = await mongoose.startSession();
  //     session.startTransaction();
  
  //     const user = await this.userRepository.findById(userId);
  //     if (!user) {
  //       throw createError('ValidationError', 'User not found');
  //     }
  //     const oldAvatarUrl = user.avatar; // Store the old avatar URL
  
  //     const cloudImage = await this.cloudinaryService.uploadImage(file, userId);
  //     const newAvatarUrl = cloudImage.url;
  
  //     const result = await this.userRepository.updateAvatar(userId, newAvatarUrl);
  //     if (!result) {
  //       throw createError('InternalServerError', 'Error updating avatar');
  //     }
  
  //     if (oldAvatarUrl) {
  //       await this.cloudinaryService.deleteAssetByUrl(userId ,oldAvatarUrl);
  //     }
  //     await session.commitTransaction();
  //     session.endSession();
  //     return null;
  //   } catch (error: any) {
  //     if (session) {
  //       await session.abortTransaction();
  //       session.endSession();
  //     }
  //     throw createError(error.name, error.message);
  //   }
  // }

  async updateAvatar(userId: string, file: Buffer): Promise<void> {
    let session: ClientSession | null = null;
  
    try {
      // Start the MongoDB session
      session = await mongoose.startSession();
      session.startTransaction();
  
      const user = await this.userRepository.findById(userId, {session} );
      if (!user) {
        throw createError('ValidationError', 'User not found');
      }
      const oldAvatarUrl = user.avatar; // Store the old avatar URL
  
      const cloudImage = await this.cloudinaryService.uploadImage(file, userId);
      const newAvatarUrl = cloudImage.url;
  
      const result = await this.userRepository.updateAvatar(userId, newAvatarUrl, { session });
      if (!result) {
        throw createError('InternalServerError', 'Error updating avatar');
      }
  
      // Step 3: Delete the old avatar from Cloudinary, if it exists
      // if (oldAvatarUrl) {
      //   const cloudDeleteResult = await this.cloudinaryService.deleteAssetByUrl(userId, oldAvatarUrl);
      //   if (cloudDeleteResult.result !== 'ok') {
      //     throw createError('CloudinaryError', 'Failed to delete old avatar');
      //   }
      // }
  
      await session.commitTransaction();
    } catch (error: any) {
      if (session) {
        await session.abortTransaction();
      }
      throw createError(error.name, error.message);
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }


  async updateCover(userId: string, file: Buffer): Promise<void> {
    let session: ClientSession | null = null;
  
    try {
      // Start the MongoDB session
      session = await mongoose.startSession();
      session.startTransaction();
  
      const user = await this.userRepository.findById(userId, { session });
      if (!user) {
        throw createError('ValidationError', 'User not found');
      }
      const oldCoverUrl = user.cover; 
  
      const cloudImage = await this.cloudinaryService.uploadImage(file, userId);
      const newCoverUrl = cloudImage.url;
  
      const result = await this.userRepository.updateCover(userId, newCoverUrl, { session });
      if (!result) {
        throw createError('InternalServerError', 'Error updating cover');
      }
  
      // if (oldCoverUrl) {
      //   const cloudDeleteResult = await this.cloudinaryService.deleteAssetByUrl(userId, oldCoverUrl);
      //   if (cloudDeleteResult.result !== 'ok') {
      //     throw createError('CloudinaryError', 'Failed to delete old cover');
      //   }
      // }
  
      await session.commitTransaction();
    } catch (error: any) {
      if (session) {
        await session.abortTransaction();
      }
      throw createError(error.name, error.message);
    } finally {
      if (session) {
        session.endSession();
      }
    }
  }
   

  async deleteUser(id: string): Promise<void> {
    const session = await mongoose.startSession();
    console.log('initiating transaction...');
    session.startTransaction();
  
    try {
      const user = await this.userRepository.findById(id, {session});
      if (!user) {
        throw createError('PathError', 'User not found');
      }
  
      console.log('trying to delete images from cloudinary...');
      const cloudResult = await this.cloudinaryService.deleteMany(user.username);
      if (cloudResult.result !== 'ok') {
        await session.abortTransaction();
        throw createError(
          'CloudinaryError',
          cloudResult.message || 'Error deleting cloudinary data'
        );
      }
      console.log('trying to delete images related to the user from MongoDB...');
      await this.imageRepository.deleteMany(id, {session});
  
      console.log('trying to delete the user from MongoDB...');
      await this.userRepository.delete(id, {session});
  
      console.log('concluding transaction...');
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw createError(error.name, error.message);
    } finally {
      session.endSession();
    }
  }
  
  async getUserById(id: string): Promise<IUser | null> {
    try {
      const user = await this.userRepository.findById(id);
      if(!user){
        throw createError('PathError', 'User not found')
      }
      return user
    } catch (error) {
      throw createError(error.name, error.message);

    }
  }



}