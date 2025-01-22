import { ImageRepository } from '../repositories/image.repository';
import { UserRepository } from '../repositories/user.repository';
import  CloudnaryService  from './cloudinary.service';
import { createError } from '../utils/errors';
import { IImage, ITag } from '../types';
import mongoose from 'mongoose';

export class ImageService {
  private imageRepository: ImageRepository;
  private userRepository: UserRepository;
  private cloudinaryService: CloudnaryService;

  constructor(){
    this.imageRepository = new ImageRepository();
    this.userRepository = new UserRepository();
    this.cloudinaryService = new CloudnaryService();
  }

  async uploadImage(userId: string, file: Buffer, tags: string[]): Promise<Object> {
    try {
      const user = await this.userRepository.findById(userId);
      if(!user){
        throw createError('ValidationError', 'User not found');
      }
      const cloudImage = await this.cloudinaryService.uploadImage(file, user.username);
      const image = {
        url: cloudImage.url,
        publicId: cloudImage.public_id,
        userId,
        tags: tags,
        uploadedBy: user.username,
        uploaderId: user._id
      };
      
      const img = await this.imageRepository.create(image);

      await this.userRepository.addImageToUser(userId, img.url as string);
      return img;
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async getImages(page: number, limit: number): Promise<Object> {
    try {
      return await this.imageRepository.findImages({ page, limit });
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }
  
  async getUserImages(userId: string, page: number, limit: number) {
    try {
      const result = await this.imageRepository.getByUserId(userId, { page, limit });
      if(!result){
        throw createError('InternalServerError', 'No images')
        
      }
      return result
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async searchByTags(tags: string[], page: number, limit: number): Promise<Object> {
    try {
      if(!tags || tags.length === 0) {
        throw createError('ValidationError', 'Tags are required for search')
      }
      return await this.imageRepository.searchByTags(tags, page, limit);
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }
  
  async searchByText(query: string, page: number, limit: number): Promise<Object> {
    try {
      return await this.imageRepository.textSearch(query, page, limit);
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }
  
  
  async getImageById(id: string): Promise<Object> {
    try {
      const result = await this.imageRepository.findById(id);
      if (!result) {
        throw createError('PathError', 'Image not found');
      }
      return result;
    } catch (error) {
      throw createError('InternalServerError', error.message);
    }
  }

  async deleteImage(id: string): Promise<IImage> {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {

      //only return parts of the file I need later while including the transaction
      const image = await this.imageRepository.findById(id, {
        session,
        select: 'uploadedBy url',
      });
  
      if (!image) {
        throw createError('PathError', 'Image not found');
      }
  
      // Delete the asset from cloud storage
      const cloudResult = await this.cloudinaryService.deleteAssetByUrl(image.uploadedBy, image.url);
      if (cloudResult.result !== 'ok') {
        // Abort the transaction if cloud delete fails
        await session.abortTransaction();
        throw createError(
          'CloudinaryError',
          cloudResult.message || 'Error deleting cloudinary data'
        );
      }
      // Delete the image from the database with session
      const result = await this.imageRepository.delete(id, { session });
  
      // Commit the transaction
      await session.commitTransaction();
      return result;
    } catch (error) {
      // Abort the transaction on error
      await session.abortTransaction();
      throw createError(error.name, error.message);
    } finally {
      // End the session
      session.endSession();
    }
  }
  

  async getTags(): Promise<ITag[] | ITag> {
    try {
      const result = await this.imageRepository.getTags();
      if(!result){
        throw createError('PathError', 'Tags not found');
      }
      return result;  
    } catch (error: any) {
      throw createError(error.name, error.message);

    }
  }

}