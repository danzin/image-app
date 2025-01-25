import Image, { Tag } from '../models/image.model';
import User from '../models/user.model';
import { IImage, BaseRepository, ITag, PaginationOptions, PaginationResult, IUser} from '../types';
import { createError } from '../utils/errors';
import mongoose from 'mongoose';


export class ImageRepository implements BaseRepository<IImage> {
  private model: mongoose.Model<IImage>;
  private tag: mongoose.Model<ITag>;
  private user: mongoose.Model<IUser>;
  constructor(){
    this.model = Image;
    this.tag = Tag;
    this.user = User;
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

  // async findById(id: string): Promise<IImage | null> {
  //   try {
  //     return await this.model.findById(id);
  //   } catch (error: any) {
  //     throw createError('InternalServerError', error.message);
  //   }
  // }

  /**findById method doesn't return a resolved promise anymore. 
   * In order to be able to use them with sessions, they need to accept a session
   * and return query 
   */
  async findById(id: string, options?: { session?: mongoose.ClientSession; select?: string }): Promise<IImage | null> {
    console.log('id in findById in imageRepository: ', id)
    const query = this.model.findById(id);
    console.log('query', query)
    if (options?.select) query.select(options.select);
    if (options?.session) query.setOptions({ session: options.session });
    return query.exec(); // Resolve the query manually
  }
 
  // async delete(id: string): Promise<IImage> {
  //   try {
  //     const result = await this.model.findOneAndDelete( {_id:id} );
  //     console.log('result inside image.repository: ',result);
  //     return result;
  //   } catch (error: any) {
  //     throw createError('InternalServerError', error.message);
  //   }
  // }

  /**delete method doesn't return a resolved promise anymore. 
   * In order to be able to use them with sessions, they need to accept a session
   * and return query 
   */
  async delete(id: string, options?: { session?: mongoose.ClientSession }): Promise<IImage | null> {
    console.log('Running inside imageRepository.delete with id: ', id)
    const query = this.model.findByIdAndDelete(id);
    console.log('query: ', query)

    if (options?.session) query.setOptions({ session: options.session });
    return query.exec(); // Manually resolve the query
  }

  // async deleteMany(userId: string): Promise<boolean> {
  //   const result = await this.model.deleteMany({userId: userId});
  //   return !!result;
  // }

  //accepts transaction now. Nothing else changes because the return is directly executed with .exec();
  //everything is as it used to be except now transactions actually work as expected when passed in
  async deleteMany(userId: string, session?: mongoose.ClientSession): Promise<void> {
    await this.model.deleteMany({ uploadedBy: userId }).setOptions({ session }).exec();
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