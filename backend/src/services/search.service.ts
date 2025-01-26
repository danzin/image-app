import mongoose from 'mongoose';
import { ImageRepository } from '../repositories/image.repository';
import { TagRepository } from '../repositories/tag.repository';
import { UserRepository } from '../repositories/user.repository';
import { IImage, ITag, IUser } from '../types';
import { createError } from '../utils/errors';

export class SearchService {
  constructor(
    private imageRepository: ImageRepository,
    private userRepository: UserRepository,
    private tagRepository: TagRepository,
  ) {}


  /** Universal search function. It uses a query and search throughout the database
   * It returns anything it finds with that query. That way users can search for anything. 
   * Still need to implement this functionality to the frontend. Need to build a search result component to serve results into,
   * as well as a usercard component. 
   */
 async searchAll(query: string): Promise<{ users: IUser[]; images: IImage[]; tags: ITag[] }> {
  try {
    //Search for users by query
    const users = await this.userRepository.getAll({ search: query });

    // Search for tags by query
    const tags = await this.tagRepository.searchTags(query);

    //Extract tag IDs from the found tags
    const tagIds = tags.map(tag => tag._id);

    //Search for images that have these tag IDs
    const images = await this.imageRepository.searchByTags(tagIds as mongoose.Types.ObjectId[]);

    return {
      users: users || [],
      images: images?.data || [],
      tags: tags || [],
    };
  } catch (error) {
    throw createError('InternalServerError', error.message);
  }
}


}