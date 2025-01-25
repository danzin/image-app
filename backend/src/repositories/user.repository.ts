import User from '../models/user.model';
import { IUser, BaseRepository, IFollow } from '../types'
import { createError } from '../utils/errors';
import { ImageRepository } from './image.repository';
import mongoose from 'mongoose';
import cloudinary from 'cloudinary';
import Follow from '../models/follow.model';
import { UserActionRepository } from './userAction.repository';

export class UserRepository implements BaseRepository<IUser> {
  private model: mongoose.Model<IUser>;
  private imageRepository: ImageRepository;
  private follow: mongoose.Model<IFollow>;
  private userActionRepository: UserActionRepository;


  /** 
   * Why use constructor here? 
   *  Using Construcotrs in user and image repositories allows me to initialize all the dependencies,
   *  setting up the 'model' property to reference the User model, as well as initializing other repositories 
   *  and models that the whole repository depends on.
   *  By initializing these properties in the constructor, I make sure 
   *  they're strictly tied to the instance of UserRepository(or ImageRepository, etc).
   *  This makes the class self-contained and easier to test because I can mock dependencies if I need to(I do).
   *  By encapsulating the model(User, etc) within the repository I allow myself more flexibility, 
   *  easier to test with mocks, and it follows the Single Responsibility principle 
   * 
   * When use constructors? 
   *  - It's a good idea to use constructors when there's a need to initialize properties(like models and dependencies),
   *  - If there's a need to inject dependencies(DI pattern)
   *  - State needs to be encapsulated within the instance of the class  
   * 
   * When not use constructors? 
   *  - When there's no need for initialization of state or dependencies 
   *  - The class is simple and doesn't require encapsulation, like userAction class.
   * 
   * 
   * 
   */
  constructor() {
    this.model = User;
    this.imageRepository = new ImageRepository();
    this.userActionRepository = new UserActionRepository();
    this.follow = Follow;
  }

  async create(user: IUser): Promise<IUser> {
    try {

      //`this.model` here refers to the model prop of the current instance of the repository
      //it's encapsulated within the repository so the code is modular and easier to maintain 
      // if I use User.create() instead, it couples the code tightly to the User model itself 
      // making it harder to change or test later.
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
  async followUser(followerId: string, followeeId: string): Promise<void> {
    // Check if the follow relationship already exists
    const existingFollow = await this.follow.findOne({ followerId, followeeId });
    if (existingFollow) {
      throw createError('DuplicateError', 'You are already following this user.');
    }

    // Create the follow relationship
    await this.follow.create({ followerId, followeeId });

    // Log the action
    await this.userActionRepository.logAction(followerId, 'follow', followeeId);
  }

  // Unfollow a user
  async unfollowUser(followerId: string, followeeId: string): Promise<void> {
    // Check if the follow relationship exists
    const existingFollow = await this.follow.findOne({ followerId, followeeId });
    if (!existingFollow) {
      throw createError('NotFoundError', 'You are not following this user.');
    }

    // Delete the follow relationship
    await this.follow.deleteOne({ followerId, followeeId });

    // Log the action
    await this.userActionRepository.logAction(followerId, 'unfollow', followeeId);
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