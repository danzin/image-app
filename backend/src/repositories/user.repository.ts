import User from '../models/user.model';
import { IUser, BaseRepository } from '../types'
import { createError } from '../utils/errors';
import { ImageRepository } from './image.repository';
import mongoose from 'mongoose';
import cloudinary from 'cloudinary';

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

  // async findById(id: string): Promise<IUser | null> {
  //   try {
  //     const result = await this.model.findById(id);
  //     if(!result){
  //       return null
  //     }
  //     return result;
  //   } catch (error) {
  //     throw createError('InternalServerError', error.message);
  //   }
  // }

  async findById(id: string, options?: {session?: mongoose.ClientSession}): Promise<IUser | null> {
    try {
      const result = this.model.findById(id).setOptions({ session: options?.session }).exec();
      if(!result) {
        return null;
      }
      return result
    } catch (error) {
      throw createError('InternalServerError', error.message)
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
      const filter = {_id: id}
      const update = {
        $set: {...userData}
      }
      const options = { returnOriginal: false };

      const user = await this.model.findOneAndUpdate(filter, update, options);
      if(!user){
        return null;
      }
      return user;
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async addImageToUser(userId: string, imageUrl: string): Promise<IUser | null> {
    try {

      return this.model.findByIdAndUpdate(userId, { $push: { images: imageUrl } }, { new: true });
    } catch (error) {
      throw createError('InternalServerError', error.message)
    }
  }

  async updateAvatar(userId: string, avatar: string, options?: {session?: mongoose.ClientSession}): Promise<string | null>{
    try {
      const result = await this.model.findByIdAndUpdate(userId, {$set: {avatar: avatar}}).setOptions({session: options.session});
      if(!result){
        return null;
      }
      return avatar;
    } catch (error) {
      throw createError('InternalServerError', error.message)
    }
  }

  async updateCover(userId: string, cover: string, options?: {session?: mongoose.ClientSession}): Promise<string | null>{
    try {
      const result = await this.model.findByIdAndUpdate(userId, {$set: {cover: cover}}).setOptions({session: options.session});
      if(!result){
        return null;
      }
      return cover;
    } catch (error) {
      throw createError('InternalServerError', error.message)
    }
  }



  //TODO: Handle cloudinary deletion and tags
  // async delete(id: string): Promise<boolean> {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();
  //   try {
  //     //then delete the user
  //     const result = await this.model.deleteOne({ _id: id }); 

  //     return !!result.deletedCount;
  //   } catch (error) {
     
  //     throw createError('InternalServerError', error.message);
  //   }
  // }

  //delete now accepts transactions, returns 
  //!! IMPORTANT!!!: 
  // since it resolves with .exec() I can't chain additional methods like sort() in the service layer
  async delete(id: string, options?: {session?: mongoose.ClientSession}): Promise<void> {
    await this.model.findByIdAndDelete(id).setOptions({session: options.session }).exec();
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