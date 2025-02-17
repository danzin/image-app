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
    
    async getFeedForUser(
      followingIds: string[],
      favoriteTags: string[],
      limit: number,
      skip: number,
    ): Promise<PaginationResult<IImage>> {
      try{
      const followingIdsObj = followingIds.map(id => new mongoose.Types.ObjectId(id));
      
      const hasPreferences = followingIds.length > 0 || favoriteTags.length > 0;
    
      //Aggregation pipeline for custom user feeds
      //When the customized content is over, it defaults back ot recency
      const [results, total] = await Promise.all([
        this.model.aggregate([
          // Stage 1: $lookup for the tags
          {
            $lookup: {
              from: 'tags',
              localField: 'tags',
              foreignField: '_id',
              as: 'tagObjects'
            }
          },
    
          // Stage 2: Add tag name field to the operation
          {
            $addFields: {
              tagNames: {
                $map: {
                  input: '$tagObjects',
                  as: 'tag',
                  in: '$$tag.tag'
                }
              }
            }
          },
    
          // Stage 3: Add a field to identify if content matches user preferences
          {
            $addFields: {
              isPersonalized: hasPreferences ? {
                $or: [
                  { $in: ['$user', followingIdsObj] },
                  { $gt: [{ $size: { $setIntersection: ['$tagNames', favoriteTags] } }, 0] }
                ]
              } : false
            }
          },
    
          // Stage 4: Sort by personalization and date
        
          {
            $sort: {
              isPersonalized: -1,  // Personalized content first if it exists
              createdAt: -1       // Then by date
            }
          },
    
          // Stage 5: Skip and limit

          { $skip: skip },
          { $limit: limit },
    
          // Stage 6: Lookup user info
          {
            $lookup: {
              from: 'users',
              localField: 'user',
              foreignField: '_id',
              as: 'userInfo'
            }
          },
    
          // Stage 7: Unwind user info
          { $unwind: '$userInfo' },
    
          // Stage 8: Final projecton
          {
            $project: {
              _id: 0,
              id: '$_id',
              url: 1,
              publicId: 1,
              createdAt: 1,
              likes: 1,
              tags: { // Transoform tags so they're returned the same way they are from findWithPagination
                $map: {
                  input: '$tagObjects',
                  as: 'tagObj',
                  in: {
                    tag: '$$tagObj.tag',
                    id: '$$tagObj._id'
                  }
                }
              },
              user: {
                id: '$userInfo._id',
                username: '$userInfo.username',
                avatar: '$userInfo.avatar'
              },
              isPersonalized: 1  // This is for debugging if needed later
            }
          }
        ]).exec(),
    
        // Count total available images (personalized and non-personaliezed)
        this.model.countDocuments({})
      ]);
    
      // Calculate total pages based on total document count
      const totalPages = Math.ceil(total / limit);
      const currentPage = Math.floor(skip / limit) + 1;
    
      // Return data in the format expected by the frontend
      return {
        data: results,
        total,
        page: currentPage,
        limit,
        totalPages
      };
    
      } catch (error) {
        console.error(error)
        throw createError('DatabaseError', error.message)
      }
     
    }
    
}