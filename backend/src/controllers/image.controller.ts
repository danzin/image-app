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

      const result = await this.imageService.uploadImage(decodedUser.id, file.buffer);
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

      res.status(201).json(images);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  }

  async getUserImages(req: Request, res: Response, next: NextFunction): Promise<void> {
    const {decodedUser} = req;
   
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    try {
      const images = await this.imageService.getUserImages(decodedUser.id, page, limit);
      res.status(201).json(images);
    } catch (error) {
      next(createError('UnknownError', 'Failed to fetch images'))
    }
  }

  async getImageById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      console.log('ID:',id);
      const result = await this.imageService.getImageById(id);
      res.status(200).json(result);
    } catch (error) {
      console.error(error)
      next(createError(error.name, error.message));
    }
  }

}