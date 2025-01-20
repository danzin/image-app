import Image, { Tag } from '../models/image.model';
import { IImage, BaseRepository, ITag} from '../types';
import { createError } from '../utils/errors';
import mongoose from 'mongoose';

export interface PaginationResult<T> {
  data: T[] | T;
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
  private tag: mongoose.Model<ITag>;

  constructor(){
    this.model = Image;
    this.tag = Tag;
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
  
      //assemble sort order
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
  
  
      if (!data || data.length === 0) {
        console.warn('No images found for user:', userId);
      }
  
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
    } catch (error: any) {
      console.error('Error fetching images:', error);
      throw createError('InternalServerError', error.message);
    }
  }

  async searchByTags(tags: string[], page: number = 1, limit: number = 20): Promise<PaginationResult<IImage>> {
    try {
      const skip = (page - 1) * limit;
  
      const [data, total] = await Promise.all([
        this.model
          .find({ tags: { $in: tags } }) 
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments({ tags: { $in: tags } }),
      ]);
  
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }
  
  async textSearch(query: string, page: number = 1, limit: number = 20): Promise<PaginationResult<IImage>> {
    try {
      const skip = (page - 1) * limit;
  
      const [data, total] = await Promise.all([
        this.model
          .find({ $text: { $search: query } }) // Text search for the query
          .skip(skip)
          .limit(limit)
          .exec(),
        this.model.countDocuments({ $text: { $search: query } }),
      ]);
  
      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
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

  async delete(id: string): Promise<IImage> {
    try {
      const result = await this.model.findOneAndDelete( {_id:id} );
      console.log('result inside image.repository: ',result);
      return result;
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

  async getTags(): Promise<ITag[] | ITag> {
    try {
      return await this.tag.find().sort({modifiedAt: -1});
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }
}