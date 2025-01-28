import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse, ConfigOptions } from 'cloudinary';
import { bufferToStream } from '../utils/readable';
import { createError } from '../utils/errors';
import { CloudinaryResponse } from '../types';
import { inject, injectable } from 'tsyringe';



@injectable()
export class CloudinaryService {
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


  async uploadImage(file: Buffer, username: string) {
    try {
      const result = await cloudinary.uploader.upload(
        `data:image/png;base64,${file.toString('base64')}`, // Convert Buffer to base64
        { folder: username }
      );
  
      return {
        url: result.secure_url,
        public_id: result.public_id,
      };
    } catch (error) {
      throw createError(error.name, error.message);

    }
    

  }

 async deleteMany(username: string): Promise<CloudinaryResponse> {
    try {
      console.log(`executing cloudinary.api.delete_resources_by_prefix(${username})`)
      const result = await cloudinary.api.delete_resources_by_prefix(username);
      console.log('result from execution: ', result)
      return result;
    } catch (error) {
      console.error('Error deleting assets:', error);
      throw error;
    }
  }async deleteAssetByUrl(username: string, url: string): Promise<{ result: string }> {
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
      throw createError('CloudError', error.message);
    }
  }

}
