import { Model, ClientSession } from 'mongoose';
import { IUser, PaginationOptions, PaginationResult } from '../types';
import { createError } from '../utils/errors';
import { injectable, inject } from 'tsyringe';
import { BaseRepository } from './base.repository';

@injectable()
export class UserRepository extends BaseRepository<IUser>{
  constructor(
    @inject('UserModel') model: Model<IUser>
  ) {
    super(model)
  }
  
  // Override create with duplicate key error handling
  async create(userData: Partial<IUser>, session?: ClientSession): Promise<IUser> {
    try {
      const doc = new this.model(userData);
      if (session) doc.$session(session);
      return await doc.save();
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        throw createError('DuplicateError', `${field} already exists`);
      }
      throw createError('DatabaseError', error.message);
    }
  }
  

  // Override update for more flexibility when working with different types of updates
  //for example, this supports any type of provided, like: { $addToSet: { following: followeeId } }
  //USE WITH CAUTION!!! If this starts backfiring, might as well keep the base repository method and add a bunch of specific methods instead,
  //like `addToFollow` `removeFromFollow` `addToLike` and bloat the this into oblivion
  //maybe I should also get rid of updateCover and updateAvatar.... 
  async update(
    id: string,
    updateData: any,  
    session?: ClientSession
  ): Promise<IUser | null> {
    try {
      const query = this.model.findByIdAndUpdate(
        id,
        updateData,  
        { new: true }
      )
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }
  

  async getAll(options: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<IUser[] | null> {
    try {
      
      const query: any = {};

    if (options.search) {
      query.$text = { $search: options.search };
    }

    const page = options?.page || 1;
    const limit = options?.limit || 20;
    
    const skip = (page - 1) * limit;

    const result = await this.model.find(query)
      .skip(skip)
      .limit(limit)
      .exec();
      if(!result || result.length === 0 ){
        return null
      }


      return result;
    } catch (error) {
      createError('DatabaseError', error.message, {
        function: 'getAll',
        options: options
      })
    }
    
  }

  async findByUsername(username: string, session?: ClientSession): Promise<IUser | null> {
    try {
      const query = this.model.findOne({ username }).select('+password');
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);

    }
  }
  
  async findByEmail(email: string, session?: ClientSession): Promise<IUser | null> {
    try {
      const query = this.model.findOne({ email }).select('+password');
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }

  // Pagination
  async findWithPagination(options: PaginationOptions): Promise<PaginationResult<IUser>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder };

      const [data, total] = await Promise.all([
        this.model
          .find()
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments()
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }

  // Profile-specific updates
  async updateAvatar(
    userId: string, 
    avatarUrl: string, 
    session?: ClientSession
  ): Promise<void> {
    try {
      const query = this.model.findByIdAndUpdate(
        userId,
        { $set: { avatar: avatarUrl } }
      );
      if (session) query.session(session);
      await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }


  async updateCover(
    userId: string, 
    coverUrl: string, 
    session?: ClientSession
  ): Promise<void> {
    try {
      const query = this.model.findByIdAndUpdate(
        userId,
        { $set: { cover: coverUrl } }
      );
      if (session) query.session(session);
      await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }


}

