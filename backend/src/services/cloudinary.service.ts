import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { bufferToStream } from '../utils/readable';
import { createError } from '../utils/errors';
import { CloudinaryResponse } from '../types';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class CloudinaryService {
  
  private extractPublicId(url: string): string | null {
    const regex = /\/(?:v\d+\/)?([^\/]+)\.[a-zA-Z]+$/;
    const matches = url.match(regex);
    return matches ? matches[1] : null;
  }


  async uploadImage(buffer: Buffer, username: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = bufferToStream(buffer);

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: username },
        (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
          
          if (error) {
            console.log(error)
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      
      stream.pipe(uploadStream);
    });
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
  }
  async deleteAssetByUrl(username:string, url: string): Promise<CloudinaryResponse> {
    const publicId = this.extractPublicId(url);
    if (!publicId) {
      throw new Error('Invalid URL format');
    }

    try {
      console.log("URL of image about to delete:", url)
      const assetPath = `${username}/${publicId}`
      const result = await cloudinary.uploader.destroy(assetPath);
      console.log(result);
      return result;
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw createError('CloudError', error.message)
    }
  }

}

export default CloudinaryService; 