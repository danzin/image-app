import { ImageRepository } from '../repositories/image.repository';
import { UserRepository } from '../repositories/user.repository';
import CloudinaryService from './cloudinary.service';
import { createError } from '../utils/errors';
import { IImage, ITag, PaginationResult } from '../types';
import mongoose, { ClientSession } from 'mongoose';
import { errorLogger } from '../utils/winston';
import { TagRepository } from '../repositories/tag.repository';

export class ImageService {
  constructor(
    private readonly imageRepository: ImageRepository,
    private readonly userRepository: UserRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly tagRepository: TagRepository
  ) {}

  async uploadImage(userId: string, file: Buffer, tags: string[]): Promise<IImage> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await this.userRepository.findById(userId);
      if (!user) throw createError('ValidationError', 'User not found');

      const cloudImage = await this.cloudinaryService.uploadImage(file, user.username);

      const tagIds = await Promise.all(
        tags.map(async (tag) => {
          const existingTag = await this.tagRepository.findByTag(tag);
          return existingTag
            ? existingTag._id
            : (await this.tagRepository.create(tag, session))._id;
        })
      );

      const image = await this.imageRepository.create(
        {
          url: cloudImage.url,
          publicId: cloudImage.public_id,
          user: user._id,
          tags: tagIds,
        },
        session
      );

      await this.userRepository.addImageToUser(userId, image.url, session);

      await session.commitTransaction();
      return image;
    } catch (error) {
      await session.abortTransaction();
      throw createError(error.name, error.message);
    } finally {
      session.endSession();
    }
  }

  async getImages(page: number, limit: number): Promise<PaginationResult<IImage>> {
    return await this.imageRepository.findWithPagination({ page, limit });
  }

  async getUserImages(userId: string, page: number, limit: number): Promise<PaginationResult<IImage>> {
    return await this.imageRepository.findByUserId(userId, { page, limit });
  }

  async searchByTags(tags: string[], page: number, limit: number): Promise<PaginationResult<IImage>> {
    const tagIds = await Promise.all(
      tags.map(async (tag) => {
        const existingTag = await this.tagRepository.findByTag(tag);
        if (!existingTag) throw createError('NotFoundError', `Tag '${tag}' not found`);
        return existingTag._id;
      })
    );
    return await this.imageRepository.findByTags(tagIds, { page, limit });
  }

  async getImageById(id: string): Promise<IImage> {
    const image = await this.imageRepository.findById(id);
    if (!image) throw createError('PathError', 'Image not found');
    return image;
  }

  async deleteImage(id: string): Promise<{ message: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const image = await this.imageRepository.findById(id, session);
      if (!image) throw createError('PathError', 'Image not found');

      await this.imageRepository.delete(id, session);
      await this.cloudinaryService.deleteAssetByUrl(image.user.username, image.url);

      await session.commitTransaction();
      return { message: 'Image deleted successfully' };
    } catch (error) {
      await session.abortTransaction();
      errorLogger.error(error.stack);
      throw createError('TransactionError', error.message);
    } finally {
      session.endSession();
    }
  }

  async getTags(): Promise<ITag[]> {
    return await this.tagRepository.getAllTags();
  }
}
