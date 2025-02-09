import mongoose, { Model, ClientSession, SortOrder } from 'mongoose';
import { BaseRepository } from './base.repository';
import { IImage, PaginationOptions, PaginationResult } from '../types';
import { createError } from '../utils/errors';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ImageRepository extends BaseRepository<IImage> {
  constructor(
    @inject('ImageModel') model: Model<IImage>
  ) {
    super(model)
  }

  /**
   * Finds an image by its ID and populates related fields.
   * 
   * @param {string} id - The ID of the image.
   * @param {ClientSession} [session] - Optional MongoDB transaction session.
   * @returns {Promise<IImage | null>} - The found image or null if not found.
   */
  async findById(id: string, session?: ClientSession): Promise<IImage | null> {
    try {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return null; 
      }
      const query = this.model.findById(id)
        .populate('user', 'username')
        .populate('tags', 'tag');
      
      if (session) query.session(session);
      const result = await query.exec();
      console.log(result)
      return result
    } catch (error) {
      throw createError('DatabaseError', error.message);
    }
  }

  /**
   * Finds images with pagination support.
   * 
   * @param {PaginationOptions} options - Pagination options (page, limit, sort order).
   * @param {ClientSession} [session] - Optional MongoDB transaction session.
   * @returns {Promise<PaginationResult<IImage>>} - Paginated result of images.
   */
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

  /**
   * Finds images uploaded by a specific user with pagination support.
   * 
   * @param {string} userId - The ID of the user.
   * @param {PaginationOptions} options - Pagination options.
   * @returns {Promise<PaginationResult<IImage>>} - Paginated result of user's images.
   */
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

   /**
   * Finds images that have specific tags, with pagination support.
   * 
   * @param {string[]} tagIds - List of tag IDs to filter images.
   * @param {PaginationOptions} [options] - Optional pagination and sorting options.
   * @returns {Promise<PaginationResult<IImage>>} - Paginated result of images matching the tags.
   */
  async findByTags(
    tagIds: string[],
    options?: {
      page?: number;
      limit?: number;
      sortBy?: string;
      sortOrder?: string;
    }
  ): Promise<PaginationResult<IImage>> {
    try {
      
      const page = options?.page || 1;
      const limit = options?.limit || 20;
      const sortOrder = options?.sortOrder || 'desc';
      const sortBy = options?.sortBy || 'createdAt';

      const skip = (page - 1) * limit;
      const sort = { [sortBy]: sortOrder as SortOrder };
      
      // Execute both queries concurrently for efficiency
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
      throw createError('DatabaseError', error.message, {
        function: 'findByTags',
        options: options
      });
    }
  }
  
   /**
   * Deletes all images associated with a specific user.
   * Supports MongoDB transactions if a session is provided.
   * 
   * @param {string} userId - The ID of the user whose images will be deleted.
   * @param {ClientSession} [session] - Optional MongoDB transaction session.
   * @returns {Promise<void>} - Resolves when deletion is complete.
   */
    async deleteMany(userId: string,  session?: ClientSession ): Promise<void> {
      try {
        const query = this.model.deleteMany({ user: userId });
        if (session) query.session(session); 
        const result = await query.exec();
        console.log(`result from await query.exec() : ${result} `)
      } catch (error) {
        throw createError('DatabaseError', error.message)
      }
    }
}