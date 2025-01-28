import { Model, ClientSession } from 'mongoose';
import { BaseRepository } from '../database/UnitOfWork';
import { IImage, PaginationOptions, PaginationResult } from '../types';
import { createError } from '../utils/errors';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ImageRepository {
  constructor(
    @inject('ImageModel') private readonly model: Model<IImage>
  ) {}

  // Override create
  async create(image: Partial<IImage>, session?: ClientSession): Promise<IImage> {
    try {
      console.log(`creatingItem: ${image}`)
      const doc = new this.model(image);
      if (session) doc.$session(session);
      return await doc.save();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }

  // Override findById for population
  async findById(id: string, session?: ClientSession): Promise<IImage | null> {
    try {
      const query = this.model.findById(id)
        .populate('user', 'username')
        .populate('tags', 'tag');
      
      if (session) query.session(session);
      return await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }


  async findWithPagination(
    options: PaginationOptions, 
    session?: ClientSession
  ): Promise<PaginationResult<IImage>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder };

      const query = this.model.find();
      if (session) query.session(session);

      const [data, total] = await Promise.all([
        query
          .populate('user', 'username')
          .populate('tags', 'tag')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments().session(session)
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

  
  async delete(id: string, session?: ClientSession): Promise<void> {
    try {
      const query = this.model.findByIdAndDelete(id);
      if (session) query.session(session);
      await query.exec();
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }

  async findByUserId(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginationResult<IImage>> {
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
          .find({ user: userId })
          .populate('user', 'username')
          .populate('tags', 'tag')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments({ user: userId })
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

  async findByTags(
    tagIds: string[],
    options: PaginationOptions
  ): Promise<PaginationResult<IImage>> {
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
          .find({ tags: { $in: tagIds } })
          .populate('user', 'username')
          .populate('tags', 'tag')
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments({ tags: { $in: tagIds } })
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
  //accepts transaction now. Nothing else changes because the return is directly executed with .exec();
  //everything is as it used to be except now transactions actually work as expected when passed in
    async deleteMany(userId: string,  session?: ClientSession ): Promise<void> {
      const query = this.model.deleteMany({ uploadedBy: userId });
      if (session) query.session(session); 
      await query.exec();
    }
}