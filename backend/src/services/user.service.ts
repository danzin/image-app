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
    return await this.userRepository.getAll();  
  }

  async drop(): Promise<Object>{
    return this.userRepository.deleteAll();
  }

  async update(id: string, userData: Partial<IUser>,): Promise<void>{
    try {

      const user = await this.userRepository.update(id, userData);
      if(!user){
        throw createError('ValidationError', 'User not found');
      }
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  //make sure old avatars are deleted froum cloudinary when user updates them
  async updateAvatar(userId: string, file: Buffer): Promise<null> {
    let session: ClientSession | null = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
  
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw createError('ValidationError', 'User not found');
      }
      const oldAvatarUrl = user.avatar; // Store the old avatar URL
  
      const cloudImage = await this.cloudinaryService.uploadImage(file, userId);
      const newAvatarUrl = cloudImage.url;
  
      const result = await this.userRepository.updateAvatar(userId, newAvatarUrl);
      if (!result) {
        throw createError('InternalServerError', 'Error updating avatar');
      }
  
      if (oldAvatarUrl) {
        await this.cloudinaryService.deleteAssetByUrl(userId ,oldAvatarUrl);
      }
      await session.commitTransaction();
      session.endSession();
      return null;
    } catch (error: any) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw createError(error.name, error.message);
    }
  }
  

  //NOT AN ACTUAL ATOMIC SESSION TRANSACTION AS NONE
  //OF THE OPERATIONS INCLUDE THE SESSION
  //BIG FAIL ON MY PART FFS
  // async deleteUser(id: string): Promise<void> {
  //   const session = await mongoose.startSession();
  //   console.log('initiating transaction...')
  //   session.startTransaction();
  //   try {
  //     const user = await this.userRepository.findById(id);
  //     if(!user){
  //       throw createError('PathError', 'User not found')
  //     }
      
  //     //delete images from Cloudinary
  //     console.log('trying to delete images from cloudinary....')
  //     await this.cloudinaryService.deleteMany(user.username);

  //     //delete images from MongoDB
  //     console.log('trying to delete images related to the user from MongoDB')
  //     await this.imageRepository.deleteMany(id);

  //     //delete the user from MongoDB
  //     console.log('trying to delete the user from MongoDB')
  //     await this.userRepository.delete(id);

  //     console.log('concluding transaction...')
  //     await session.commitTransaction();
  //     session.endSession();

    
  //   } catch (error) {
  //     await session.abortTransaction();
  //     session.endSession();
  //     throw createError(error.name, error.message);
  //   }
  // }

  async deleteUser(id: string): Promise<void> {
    const session = await mongoose.startSession();
    console.log('initiating transaction...');
    session.startTransaction();
  
    try {
      const user = await this.userRepository.findById(id, session);
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
      await this.imageRepository.deleteMany(id, session);
  
      console.log('trying to delete the user from MongoDB...');
      await this.userRepository.delete(id, session);
  
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