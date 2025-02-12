import { Model, ClientSession } from 'mongoose';
import { IUser, PaginationOptions, PaginationResult } from '../types';
import { createError } from '../utils/errors';
import { injectable, inject } from 'tsyringe';
import { BaseRepository } from './base.repository';
import { Query, UpdateData } from '../types/customCore/others.types';

/**
 * UserRepository provides database access for user-related operations.
 * It extends BaseRepository and includes custom methods for user management.
 */

@injectable()
export class UserRepository extends BaseRepository<IUser>{
  constructor(
    @inject('UserModel') model: Model<IUser>
  ) {
    super(model)
  }
  
  /**
   * Creates a new user in the database, handling duplicate key errors.
   * @param userData - Partial user data to create a new user.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns The created user object.
   */
  async create(userData: Partial<IUser>, session?: ClientSession): Promise<IUser> {
    try {
      const doc = new this.model(userData);
      if (session) doc.$session(session);
      return await doc.save();
      //TODO: make sure catch blocks use custom error integrating the context
    } catch (error) {
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        throw createError('DuplicateError', `${field} already exists`, { 
          function: 'create',
          context: 'userRepository'
        });
      }
      throw createError('DatabaseError', error.message);
    }
  }
  

  /**
   * Updates a user's data based on a given user ID.
   * Supports flexible updates with MongoDB operators (e.g., `$set`, `$addToSet`).
   * @param id - User ID to update.
   * @param updateData - Update operations.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns The updated user object or null if not found.
   */
  async update(
    id: string,
    updateData: UpdateData,  
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
      if (error.code === 11000) {
        const field = Object.keys(error.keyValue)[0];
        throw createError('DuplicateError', `${field} already exists`, { 
          function: 'create',
          context: 'userRepository'
        });
      }
      throw createError('DatabaseError', error.message);
    }
  }
  

  async getAll(options: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<IUser[] | null> {
    try {
      
      const query: Query = {};

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

  /**
   * Finds a user by username.
   * @param username - The username to search for.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns The user object or null if not found.
   */
  async findByUsername(username: string, session?: ClientSession): Promise<IUser | null> {
    try {
      const query = this.model.findOne({ username }).select('+password');
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);

    }
  }
  
  /**
   * Finds a user by email.
   * @param email - The email to search for.
   * @param session - (Optional) Mongoose session for transactions.
   * @returns The user object or null if not found.
   */
  async findByEmail(email: string, session?: ClientSession): Promise<IUser | null> {
    try {
      const query = this.model.findOne({ email }).select('+password');
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }

  /**
   * Retrieves paginated users from the database.
   * @param options - Pagination options (page, limit, sorting).
   * @returns A paginated result containing users.
   */  
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

