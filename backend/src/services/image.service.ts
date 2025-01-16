import { ImageRepository, PaginationResult } from '../repositories/image.repository';
import { UserRepository } from '../repositories/user.repository';
import  CloudnaryService  from './cloudinary.service';
import { createError } from '../utils/errors';

export class ImageService {
  private imageRepository: ImageRepository;
  private userRepository: UserRepository;
  private cloudinaryService: CloudnaryService;

  constructor(){
    this.imageRepository = new ImageRepository();
    this.userRepository = new UserRepository();
    this.cloudinaryService = new CloudnaryService();
  }

  async uploadImage(userId: string, file: Buffer): Promise<Object> {
    try {
      const user = await this.userRepository.findById(userId);
      if(!user){
        throw createError('ValidationError', 'User not found');
      }
      const cloudImage = await this.cloudinaryService.uploadImage(file);
      const image = {
        url: cloudImage.url,
        publicId: cloudImage.public_id,
        userId,
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
      return await this.imageRepository.getByUserId(userId, { page, limit });
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

}