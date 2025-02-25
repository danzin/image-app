import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse, ConfigOptions } from 'cloudinary';
import { createError } from '../utils/errors';
import { CloudinaryDeleteResponse, CloudinaryResponse, DeletionResult } from '../types';
import { inject, injectable } from 'tsyringe';
import { IImageStorageService } from '../types/customImageStorage/imageStorage.types';



@injectable()
export class CloudinaryService implements IImageStorageService {
  constructor() {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

  }
  private extractPublicId(url: string): string | null {
    const regex = /\/(?:v\d+\/)?([^\/]+)\.[a-zA-Z]+$/;
    const matches = url.match(regex);
    return matches ? matches[1] : null;
  }


  async uploadImage(file: Buffer, username: string): Promise<{url: string, publicId: string}> {
    try {
      const result = await cloudinary.uploader.upload(
        `data:image/png;base64,${file.toString('base64')}`, // Convert Buffer to base64
        { folder: username }
      );
  
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      throw createError(error.name, error.message);

    }
  }
  
  async deleteAssetByUrl(username: string, url: string): Promise<{ result: string }> {
    const publicId = this.extractPublicId(url);
    if (!publicId) {
      throw new Error('Invalid URL format');
    }
  
    try {
      console.log("URL of image about to delete:", url);
      const assetPath = `${username}/${publicId}`;
      const result = await cloudinary.uploader.destroy(assetPath);
      console.log(result);
  
      // Return onlythe necessary fields to make sure object doesn't get polluted with unserializable data
      return { result: result.result }; // Only include the result field
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw createError('StorageError', error.message);
    }
  }

      //deletes image by public Id
      async deleteImage(publicId: string): Promise<void> {
        try {
          cloudinary.uploader.destroy(publicId)
        } catch (error) {
          console.error(error);
          throw createError(error.name, error.message);
        };
      };

  //deletes lots of images with username prefix
  async deleteMany(username: string): Promise<DeletionResult> {
    try {
      const result = await cloudinary.api.delete_resources_by_prefix(username);
      return this.processDeleteResponse(result);
    } catch (error) {
      return {
        result: 'error',
        message: error.message || 'Error deleting cloudinary resources'
      };
    }
  }

    /**
     * @processDeleteResponse method accepts the response from the resolved promise returned by cloudinary.api.delete_resources_by_prefix 
     * Object.value() converts the response object's deleted_counts into an array
     * of the values of the object. The object in this case is {'username/imagename': { original: x, derived: 0 }}
     * The array looks like this: 
     * [
     *  { original: 1, derived: 0 }
     * ]
     * .some() is an array method that returns true if AT LEAST ONE
     * element in the array satisfies the condition in the callback function.
     * The count parameter in the callback of `some()` is each object like { original: 1, derived: 0 }.
     * and the condition is > 0 
     * That way there are no unnecessary errors from successful deletions
    */
  private processDeleteResponse(response: CloudinaryDeleteResponse): DeletionResult {

  
    const hasSuccessfulDeletions = Object.values(response.deleted_counts).some(
      count => count.original > 0
    );
  
    if (hasSuccessfulDeletions) {
      return { result: 'ok' };
    }

    return {
      result: 'error',
      message: 'No resources were deleted'
    };
  }



  
}
