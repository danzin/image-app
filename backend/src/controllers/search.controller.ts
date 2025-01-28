import { NextFunction, Request, Response } from "express";
import { ImageRepository } from "../repositories/image.repository.old";
import { UserRepository } from "../repositories/user.repository.old";
import { SearchService } from "../services/search.service";
import { createError } from "../utils/errors";
import { TagRepository } from "../repositories/tag.repository";

export class SearchController {
  private searchService: SearchService;

  constructor() {
    // Init repositories
    const imageRepository = new ImageRepository();
    const userRepository = new UserRepository();
    const tagRepository = new TagRepository();
 
    // Pass them to the service
    this.searchService = new SearchService(imageRepository, userRepository, tagRepository);
  }

  async searchAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { q } = req.query; 

      if (!q) {
        throw createError('ValidationError', 'Query parameter "q" is required');
      }

      const result = await this.searchService.searchAll(q as string);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}