import { v2 as cloudinary, UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';
import { bufferToStream } from '../utils/readable';
import { createError } from '../utils/errors';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Extract the public ID from the URL



class CloudinaryService {
  private extractPublicId(url: string): string | null {
    const regex = /\/(?:v\d+\/)?([^\/]+)\.[a-zA-Z]+$/;
    const matches = url.match(regex);
    return matches ? matches[1] : null;
  }


  async uploadImage(buffer: Buffer, folderPath: string): Promise<UploadApiResponse> {
    return new Promise((resolve, reject) => {
      const stream = bufferToStream(buffer);

      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: folderPath },
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

 async deleteMany(urls) {
    try {
      const publicIds = urls.map(this.extractPublicId);

      const result = await cloudinary.api.delete_resources(publicIds);
      if(result.includes('not_found')){
        throw createError('CloudError', "Didn't delete files")
      }
      return result;
    } catch (error) {
      console.error('Error deleting assets:', error);
      throw error;
    }
  }
  async deleteAssetByUrl(userId:string, url: string): Promise<void> {
    const publicId = this.extractPublicId(url);
    if (!publicId) {
      throw new Error('Invalid URL format');
    }

    try {
      console.log("URL of image about to delete:", url)
      const assetPath = `users/${userId}/avatars/${publicId}`
      await cloudinary.uploader.destroy(assetPath);
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw createError('CloudError', error.message)
    }
  }

}

export default CloudinaryService; 