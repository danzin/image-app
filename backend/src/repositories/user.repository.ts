import User, { IUser } from '../models/user.model';
import { createError } from '../utils/errors';
import { BaseRepository } from './base.repository';
import { ImageRepository } from './image.repository';
import mongoose from 'mongoose';

export class UserRepository implements BaseRepository<IUser> {
  private model: mongoose.Model<IUser>;
  private imageRepository: ImageRepository;
  
  constructor() {
    this.model = User;
    this.imageRepository = new ImageRepository();
  }

  async create(user: IUser): Promise<IUser> {
    try {
      return await this.model.create(user);
    } catch (error: any) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        const value = error.keyValue[field];
        throw createError('DuplicateError',`${field} '${value}' is already taken.`);
      }
      throw createError('InternalServerError', error.message);
    }
  }  

  async getAll(): Promise<IUser[]>{
    return this.model.find();
  }

  async findById(id: string): Promise<IUser | null> {
    try {
      const result = await this.model.findById(id);
      if(!result){
        return null
      }
      return result;
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return this.model.findOne({ email });
  }

  async loginUser(email: string, password: string): Promise<IUser | null>{
    try {
      const user = await this.model.findOne({ email }).select('+password');
      if(!user){
        return null;
      }

      const validPassword = await user.comparePassword(password);
      if(!validPassword){
        return null;
      }

      const userObject = user.toObject();
      delete userObject.password;
      return userObject;
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    try {
      const user = await this.model.findByIdAndUpdate(id, userData, { new: true });
      if(!user){
        return null;
      }
      return user;
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async addImageToUser(userId: string, imageUrl: string): Promise<IUser | null> {
    return this.model.findByIdAndUpdate(userId, { $push: { images: imageUrl } }, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      //delete user images
      await this.imageRepository.deleteMany(id);
      
      //then delete the user
      const result = await this.model.deleteOne({ _id: id });
      
      await session.commitTransaction();
      session.endSession();
      
      return !!result.deletedCount;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw createError('InternalServerError', error.message);
    }
  }

  async deleteAll(): Promise<Object>{
    try {
      const { deletedCount } = await this.model.deleteMany(); 
      return deletedCount;
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

}