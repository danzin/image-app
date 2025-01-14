import Image, {IImage} from '../models/image.model';
import { createError } from '../utils/errors';
import { BaseRepository } from './base.repository';
import mongoose from 'mongoose';

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class ImageRepository implements BaseRepository<IImage> {
  private model: mongoose.Model<IImage>;

  constructor(){
    this.model = Image;
  }

  async create(image: any): Promise<IImage> {
    try {
      return await this.model.create(image);
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

  async getAll(): Promise<IImage[]> {
    return this.model.find();
  }

  async findImages(options: PaginationOptions = {}): Promise<PaginationResult<IImage>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;

      const sort: { [key: string]: 'asc' | 'desc' } = {
        [sortBy]: sortOrder
      };

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
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }


  async getByUserId(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginationResult<IImage>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;

      const skip = (page - 1) * limit;

      const sort: { [key: string]: 'asc' | 'desc' } = {
        [sortBy]: sortOrder
      };

      const [data, total] = await Promise.all([
        this.model
          .find({ userId })
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments({ userId })
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }


  async findById(id: string): Promise<IImage | null> {
    try {
      return await this.model.findById(id);
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

  

  async delete(id: string): Promise<boolean> {
    try {
      return await this.model.findByIdAndDelete(id);
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }


  async deleteMany(userId: string): Promise<boolean> {
    const result = await this.model.deleteMany({userId: userId});
    return !!result;
  }

  async update(id: string, updateData: Partial<IImage>): Promise<IImage | null> {
    try {
      return await this.model.findByIdAndUpdate(id, updateData, { new: true });
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

}