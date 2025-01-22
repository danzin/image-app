import { Request, Response, NextFunction } from 'express';
import { ImageService } from '../services/image.service';
import { createError } from '../utils/errors';

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
      res.json(images);
    } catch (error) {
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

  async searchByTags(req: Request, res: Response, next: NextFunction): Promise<void>{
    const { tags, page, limit } = req.query;
    try {
      const result = await this.imageService.searchByTags((tags as string).split(','), Number(page), Number(limit));
      res.json(result);
    } catch (error) {
      next(createError(error.name, error.message));
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