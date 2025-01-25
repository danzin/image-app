import { Request, Response, NextFunction } from 'express';
import { ImageService } from '../services/image.service';
import { createError } from '../utils/errors';
import { errorLogger } from '../utils/winston';

export class ImageController {
  private imageService: ImageService;

  constructor(){
    this.imageService = new ImageService();
  }

  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { decodedUser, file } = req;
      const tags = JSON.parse(req.body.tags);
      const result = await this.imageService.uploadImage(decodedUser.id, file.buffer, tags);
      res.status(201).json(result);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  }

  async getImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 9;
    try {
      const images = await this.imageService.getImages(page, limit);
      res.header('Access-Control-Allow-Origin', 'http://localhost:5173');  //specific origin
      res.header('Access-Control-Allow-Credentials', 'true');  //allow credentials
      res.json(images);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  }

  async getUserImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    const {id} = req.params;
   
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    console.log('ID of getUserImages: ', id)
    try {
      const images = await this.imageService.getUserImages(id, page, limit);
      console.log(`images of user ${id}: ${images}`);
      res.json(images);
    } catch (error) {
      errorLogger.error(error.stack);
      next(createError('UnknownError', 'Failed to fetch images'))
    }
  }

  async getImageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const result = await this.imageService.getImageById(id);
      res.json(result);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  }

  async searchByTags(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tags } = req.query; // Get tags from query parameters
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      console.log('tags in the controller:', tags)
      // Handle empty tags gracefully (no error)
      const tagArray = tags 
        ? (tags as string).split(',').filter(tag => tag.trim() !== '')
        : [];
      console.log(tagArray)
      // Call the service method
      const result = await this.imageService.searchByTags(tagArray, page, limit);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async searchByText(req: Request, res: Response, next: NextFunction): Promise<void>{
    const { query, page, limit } = req.query;
    try {
      const result = await this.imageService.searchByText(query as string, Number(page), Number(limit));
      res.json(result);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  
  }

  async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void>{
    const { id } = req.params;
    
    try {
      const result = await this.imageService.deleteImage(id);
      res.json(result)
    } catch (error) {
      errorLogger.error(error.stack)
      next(createError(error.name, error.message));

    }
  }

  async getTags(req: Request, res: Response, next: NextFunction): Promise<void>{
    try {
      const result = await this.imageService.getTags();
      res.json(result)
    } catch (error) {
      next(createError(error.name, error.message));

    }
  }

}