import { ImageRepository } from '../repositories/image.repository';
import { UserRepository } from '../repositories/user.repository';
import { CloudinaryService } from './cloudinary.service';
import { createError } from '../utils/errors';
import { IImage, ITag, PaginationResult } from '../types';
import mongoose, { Model, ObjectId } from 'mongoose';
import { errorLogger } from '../utils/winston';
import { TagRepository } from '../repositories/tag.repository';
import { UnitOfWork } from '../database/UnitOfWork';
import { inject, injectable } from 'tsyringe';

@injectable()
export class ImageService {
  constructor(
    @inject('ImageModel') private readonly imageModel: Model<IImage>,
    @inject('UserRepository') private readonly userRepository: UserRepository,
    @inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @inject('CloudinaryService') private readonly cloudinaryService: CloudinaryService,
    @inject('TagRepository') private readonly tagRepository: TagRepository,
    @inject('UnitOfWork') private readonly unitOfWork: UnitOfWork
  ) {}



  async uploadImage(userId: string, file: Buffer, tags: string[]): Promise<Object> {
    try {
      const result = await this.unitOfWork.executeInTransaction(async (session) => {
       
        // Find user
        const user = await this.userRepository.findById(userId, session);
        if (!user) {
          throw createError('ValidationError', 'User not found');
        }
        console.log(`user from findByID: ${user}`)
        
        // Process tags
        const tagIds = await Promise.all(
          tags.map(async (tag) => {
            const existingTag = await this.tagRepository.findByTag(tag, session);
            if (existingTag) {
              return existingTag._id;
            }
            const newTag = await this.tagRepository.create(tag, session);
            return newTag._id;
          })
        )
  
        const cloudImage = await this.cloudinaryService.uploadImage(file, user.username);
  
        const image = {
          url: cloudImage.url,
          publicId: cloudImage.public_id,
          user: user.id, 
          createdAt: new Date(),
          tags: tagIds, 
        } as IImage;
  
        // Create image
        const img = await this.imageRepository.create(image, session);
        console.log(`image from imageRepo.create: ${img}`)
        
        // Update user images array
        await this.userRepository.update(
          userId,
          { images: [...user.images, img.url] },
          session
        );
  
        return {
          id: img.id,
          url: img.url,
          publicId: img.publicId,
          user: {
            id: user.id,
            username: user.username,
          },
          tags: tags.map((tag) => tag),
          createdAt: img.createdAt,
        };
      });
  
      return result;
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }
  
  async getImages(page: number, limit: number): Promise<PaginationResult<IImage>> {
    try {
      return await this.imageRepository.findWithPagination({ page, limit });
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async getUserImages(userId: string, page: number, limit: number): Promise<PaginationResult<IImage>> {
    try {
      return await this.imageRepository.findByUserId(userId, { page, limit });
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async searchByTags(tags: string[], page: number, limit: number): Promise<PaginationResult<IImage>> {
    try {
      const tagIds = await Promise.all(
        tags.map(async (tag) => {
          const existingTag = await this.tagRepository.findByTag(tag);
          if (!existingTag) {
            throw createError('NotFoundError', `Tag '${tag}' not found`);
          }
          return existingTag._id;
        })
      );

      return await this.imageRepository.findByTags(tagIds as string[], { page, limit });
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async getImageById(id: string): Promise<IImage> {
    try {
      const image = await this.imageRepository.findById(id);
      if (!image) {
        throw createError('NotFoundError', 'Image not found');
      }
      return image;
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async deleteImage(imageId: string): Promise<{ message: string }> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const image = await this.imageRepository.findById(imageId, session);
      if (!image) {
        throw createError('NotFoundError', 'Image not found');
      }

      // Delete from database
      await this.imageRepository.delete(imageId, session );

      // Delete from Cloudinary
      const deletionResult = await this.cloudinaryService.deleteAssetByUrl(
        image.user.username,
        image.url
      );

      if (deletionResult.result !== 'ok') {
        throw createError('CloudError', 'Failed to delete from Cloudinary');
      }

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
    try {
      return await this.tagRepository.getAll();
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }
}