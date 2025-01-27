import { ImageRepository } from '../repositories/image.repository.old';
import { UserRepository } from '../repositories/user.repository.old';
import  CloudnaryService  from './cloudinary.service';
import { createError } from '../utils/errors';
import { IImage, ITag, PaginationResult } from '../types';
import mongoose, { ObjectId } from 'mongoose';
import { errorLogger } from '../utils/winston';
import { TagRepository } from '../repositories/tag.repository';

export class ImageService {
  private imageRepository: ImageRepository;
  private userRepository: UserRepository;
  private cloudinaryService: CloudnaryService;
  private tagRepository: TagRepository;

  constructor(){
    this.imageRepository = new ImageRepository();
    this.userRepository = new UserRepository();
    this.cloudinaryService = new CloudnaryService();
    this.tagRepository = new TagRepository();

  }

  // async uploadImage(userId: string, file: Buffer, tags: string[]): Promise<Object> {
  //   try {
  //     const user = await this.userRepository.findById(userId);
  //     if(!user){
  //       throw createError('ValidationError', 'User not found');
  //     }
  //     const cloudImage = await this.cloudinaryService.uploadImage(file, user.username);
  //     const image = {
  //       url: cloudImage.url,
  //       publicId: cloudImage.public_id,
  //       userId,
  //       tags: tags,
  //       uploadedBy: user.username,
  //       uploaderId: user._id
  //     };
      
  //     const img = await this.imageRepository.create(image);

  //     await this.userRepository.addImageToUser(userId, img.url as string);
  //     return img;
  //   } catch (error) {
  //     throw createError(error.name, error.message);
  //   }
  // }
  async uploadImage(userId: string, file: Buffer, tags: string[]): Promise<Object> {
    console.log('File buffer received:', file); // Log the buffer
    try {
    // Find the user
    console.log('finding user in uploadImage: ,', userId)
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw createError('ValidationError', 'User not found');
    }

    // Upload the image to Cloudinary
    const cloudImage = await this.cloudinaryService.uploadImage(file, user.username);

    // Convert tag strings to ObjectId references
    const tagIds = await Promise.all(
      tags.map(async (tag) => {
        console.log('Tag inside tagIds conversion in imageService: ', tag)
        const existingTag = await this.tagRepository.findByTag(tag);
        if (existingTag) {
          return existingTag._id; // Use existing tag's ObjectId
        } else {
          const newTag = await this.tagRepository.create(tag); 
          return newTag._id;
        }
      })
    );

    // Create the image object
    const image = {
      url: cloudImage.url,
      publicId: cloudImage.public_id,
      user: {
        _id: user._id,
        username: user.username
      }, 
      tags: tagIds, //use teh converted ObjectId references
    };

    // Save the image to the database
    const img = await this.imageRepository.create(image);

    //Add the image URL to the user's images array
    await this.userRepository.addImageToUser(userId, img.url as string);

     return {
      _id: img._id,
      url: img.url,
      publicId: img.publicId,
      user: img.user,
      tags: img.tags,
      createdAt: img.createdAt,
    };
  } catch (error) {
    throw createError(error.name, error.message);
  }
}

  async getImages(page: number, limit: number): Promise<Object> {
    try {
      const result = await this.imageRepository.findImages({ page, limit });
      return result;
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

  async searchByTags(tags: string[], page: number, limit: number): Promise<PaginationResult<IImage>> {
    try {
      let tagIds: any[] = [];
      console.log(`tags inside searchByTags in imageService: ${tags}`)
      // Only convert tags if they exist
      if (tags.length > 0) {
        tagIds = await Promise.all(
          tags.map(async (tag) => {
            const existingTag = await this.tagRepository.findByTag(tag);
            if (!existingTag) {
              throw createError('NotFoundError', `Tag '${tag}' not found.`);
            }
            return existingTag._id as Partial<mongoose.Types.ObjectId>;
          })
        );
      }
      console.log('tagIds: ', tagIds)
  
      // If no tags, return all images 
      const result = await this.imageRepository.searchByTags(tagIds, page, limit);
      console.log('result: ', result)
      return result;
    } catch (error) {
      throw createError(error.name, error.message);
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

  async deleteImage(id: string): Promise<Object> {
    console.log('--------Running DELETEIMAGE:---------- \n\r ');
    console.log('id coming in to imageService:', id);
  
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      // Fetch the image with the required fields, including the session
      const image = await this.imageRepository.findById(id, {
        session,
        select: 'url user',
      });
      console.log('image returned by await this.imageRepository.findById:', image);
  
      if (!image) {
        throw createError('PathError', 'Image not found');
      }
  
      // Delete the image from the database with the session
      console.log(`calling await this.imageRepository.delete(${id}, ${{ session }});`);
      const result = await this.imageRepository.delete(id, { session });
      console.log('result:', result);
  
      // Delete the asset from Cloudinary
      console.log(`await this.cloudinaryService.deleteAssetByUrl(${image.user.username}, ${image.url})`);
      const cloudResult = await this.cloudinaryService.deleteAssetByUrl(image.user.username, image.url);
      console.log('cloudinary result:', cloudResult);
  
      if (cloudResult.result !== 'ok') {
        await session.abortTransaction();
        throw createError('CloudError', cloudResult.result || 'Error deleting Cloudinary data');
      }
  
      await session.commitTransaction();
      /**There was a problem where after successful deletion of the document, the frontend received the following response: 
       * 'UnknownError: Cannot create Buffer from the passed potentialBuffer.  
       *  at createError (D:\dev\TypeScriptPhotoApp\backend\src\utils\errors.ts:82:10) 
       *  at ImageController.deleteImage (D:\dev\TypeScriptPhotoApp\backend\src\controllers\image.controller......'
       * 
       *  This is due to the fact that somewhere along the chain, there is a non-serializable object in the response, like a Buffer.
       *  I spent over 3 hours trying to figure out where this is coming from, what's causing it, 
       *  re-writing the cloudinary service logic, the image repository logic, the image schema, the user schema, the mongoose middleware...EVERYTHING. 
       *  I TRIED EVERYTHING AND NOTHING WORKED. I WAS HARDSTUCK. 
       *  
       * Well, the fix is to just return the success message. There was absolutely no need to return the object. 
       * Nobody cares about the deleted object. Why was I returning it. 
       * 
       * 
       * The fix to my 3-4 hour struggle was literally : `message: 'Image deleted successfully'`
       * 
       *        
       */
      return { message: 'Image deleted successfully' };
    } catch (error) {
      await session.abortTransaction();

      errorLogger.error(error.stack);
  
      // Re-throw the error with specific transaction type
      throw createError('TransactionError', error.message);
    } finally {
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