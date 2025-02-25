import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { IImageStorageService } from '../types';
import { injectable } from 'tsyringe';
import { createError } from '../utils/errors';

@injectable()
export class LocalStorageService implements IImageStorageService {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.join(process.cwd(), 'uploads'); //process.cwd() gets to the root of the project

    //Create the uploadsDir if it's missing
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async uploadImage(file: Buffer, username: string): Promise<{ url: string; publicId: string }> {
    try {
      const filename = `${uuidv4()}.png`; // uuidv4() generates a unique filename
      const userDir = path.join(this.uploadsDir, username); // Create a user-specific directory
      const filepath = path.join(userDir, filename); 

      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      await fs.promises.writeFile(filepath, file);
      const url = `/uploads/${username}/${filename}`;

      return { url, publicId: filename };
    } catch (error) {
      console.error(error);
      throw createError(error.name, error.message);
    }
  }

  async deleteImage(publicId: string): Promise<void>{
    try {
      const filePath = path.join(this.uploadsDir, publicId);

      if(fs.existsSync(filePath)){
        await fs.promises.unlink(filePath);
      }
    } catch (error) {
      console.error(error)
      throw createError(error.name, error.message)
    }
  }

  async deleteAssetByUrl(username: string, url: string): Promise<{ result: string }> {
    try {
      console.log('URL of image about to delete:', url);

      const publicId = this.extractPublicId(url);
      if (!publicId) {
        throw createError('InvalidURL', 'Could not extract publicId from URL');
      }

      const assetPath = path.join(this.uploadsDir, username, publicId);
      await fs.promises.unlink(assetPath);

      return { result: 'ok' };
    } catch (error) {
      console.error('Error deleting asset:', error);
      throw createError('StorageError', error.message);
    }
  }
  

  async deleteMany(username: string): Promise<{ result: 'ok' | 'error'; message?: string }> {
    try {
      const userDir = path.join(this.uploadsDir, username);

      if (!fs.existsSync(userDir)) {
        return { result: 'ok', message: 'User folder does not exist, nothing to delete.' };
      }

      const files = await fs.promises.readdir(userDir);

      if (files.length === 0) {
        return { result: 'ok', message: 'User folder is already empty.' };
      }

      // Delete all files inside the user's folder
      await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(userDir, file);
          await fs.promises.unlink(filePath);
        })
      );

      // Remove the folder after deleting its contents
      await fs.promises.rmdir(userDir);

      return { result: 'ok', message: `Successfully deleted all images for user: ${username}` };
    } catch (error) {
      console.error('Error deleting multiple assets:', error);
      return {
        result: 'error',
        message: error.message || 'Error deleting local storage resources',
      };
    }
  }

  private extractPublicId(url: string): string | null {
    const regex = /\/uploads\/(?:[^\/]+)\/([^\/]+)$/;
    const matches = url.match(regex);
    return matches ? matches[1] : null;
  }
}
