import { Model, ClientSession } from 'mongoose';
import { IUser, PaginationOptions, PaginationResult } from '../types';
import { createError } from '../utils/errors';

export class UserRepository {
  constructor(private readonly model: Model<IUser>) {}

  // Core CRUD operations
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

  async findById(id: string, session?: ClientSession): Promise<IUser | null> {
    try {
      const query = this.model.findById(id);
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

  async update(
    id: string, 
    userData: Partial<IUser>, 
    session?: ClientSession
  ): Promise<IUser | null> {
    try {
      const query = this.model.findByIdAndUpdate(
        id,
        { $set: userData },
        { new: true }
      );
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }

  async delete(id: string, session?: ClientSession): Promise<void> {
    try {
      const query = this.model.findByIdAndDelete(id);
      if (session) query.session(session);
      await query.exec();
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
}