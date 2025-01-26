import Image, { Tag } from '../models/image.model';
import Like from '../models/like.model';
import User from '../models/user.model';
import { IImage, BaseRepository, ITag, PaginationOptions, PaginationResult, IUser, ILike} from '../types';
import { createError } from '../utils/errors';
import mongoose, { ObjectId } from 'mongoose';


export class ImageRepository implements BaseRepository<IImage> {
  private model: mongoose.Model<IImage>;
  private tag: mongoose.Model<ITag>;
  private user: mongoose.Model<IUser>;
  private like: mongoose.Model<ILike>;
  constructor(){
    this.model = Image;
    this.tag = Tag;
    this.user = User;
    this.like = Like;
  }

  async create(image: any, options?: { session?: mongoose.ClientSession }): Promise<IImage> {
    try {
      console.log('image inside create image repository', image)
      const doc = new this.model(image);
      //session argument needs to only be passed in if necessary
      if (options?.session) doc.$session(options.session); // Set the session
      return await doc.save();
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

  async likeImage(userId: string, imageId: string): Promise<void> {
    await this.like.create({ userId, imageId });
  }

  async unlikeImage(userId: string, imageId: string): Promise<void> {
    await this.like.deleteOne({ userId, imageId });
  }


  async getAll(options: {
    tags?: string[];
    user?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<IImage[] | null> {
    const query: any = {};

    if (options.tags && options.tags.length > 0) {
      query.tags = { $in: options.tags };
    }

    //possible need for future use
    if (options.user) {
      query.user = options.user;
    }

    //possible need for future use
    if (options.search) {
      query.$text = { $search: options.search };
    }

    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;
    console.log(`query in getAll image.repository.ts: ${query}`)
    const result = await this.model.find(query)
      .populate('user', 'username')
      .populate('tags', 'tag')
      .skip(skip)
      .limit(limit)
      .exec();
      
    if(!result || result.length === 0) {
      return null
    }  
    return result
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
          .populate('tags', 'tag') // Populate the 'tags' field and only include the 'tag' field
          .populate('user', 'username') 
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
  
      console.log('userId to find images for: ', userId)
      const [data, total] = await Promise.all([
        this.model
          .find({ 'user': userId }) 
          .populate('tags', 'tag') // Populate the 'tags' field
          .populate('user', 'username')  // Populate the 'user' field to include username
          .sort(sort)
          .skip(skip)
          .limit(limit)
          
          .exec(),
        this.model.countDocuments({ 'user._id': userId }), 
      ]);
  
      console.log(`data from imageRepository getByUserId: ${data}`)
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

  async searchByTags(
    tags: mongoose.Types.ObjectId[],
    page?: number, 
    limit?: number 
  ): Promise<PaginationResult<IImage>> {
    try {
      const skip = page && limit ? (page - 1) * limit : 0; // Calculate skip only if page and limit are provided
  
      const query = this.model
        .find({ tags: { $in: tags } })
        .populate('tags', 'tag')
        .populate('user', 'username');
  
      // Apply pagination only if page and limit are provided
      if (page && limit) {
        query.skip(skip).limit(limit);
      }
  
      const [data, total] = await Promise.all([
        query.exec(),
        this.model.countDocuments({ tags: { $in: tags } }),
      ]);
  
      console.log(`data in searchByTags in image.repository.ts: ${data}`);
  
      return {
        data,
        total,
        page: page || 1, // Default to page 1 if not provided
        limit: limit || total, // Default to total count if not provided
        totalPages: limit ? Math.ceil(total / limit) : 1, // Calculate total pages only if limit is provided
      };
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

  
  async searchImages(query: string, page: number = 1, limit: number = 20): Promise<PaginationResult<IImage>> {
    try {
      const skip = (page - 1) * limit;
  
      const [data, total] = await Promise.all([
        this.model
          .find({ $text: { $search: query } })
          .populate('tags', 'tag')
          .populate('user', 'username')
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
    const query = this.model.findById(id).populate('user');
    if (options?.select) query.select(options.select);
    if (options?.session) query.session(options.session); 
    return query.exec();
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
    const query = this.model.findOneAndDelete({_id: id}); 
    //setting the session if provided
    if (options?.session) query.session(options.session); 
    return query.exec();
  }

  // async deleteMany(userId: string): Promise<boolean> {
  //   const result = await this.model.deleteMany({userId: userId});
  //   return !!result;
  // }

  //accepts transaction now. Nothing else changes because the return is directly executed with .exec();
  //everything is as it used to be except now transactions actually work as expected when passed in
  async deleteMany(userId: string, options?: { session?: mongoose.ClientSession }): Promise<void> {
    const query = this.model.deleteMany({ uploadedBy: userId });
    if (options?.session) query.session(options.session); 
    await query.exec();
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