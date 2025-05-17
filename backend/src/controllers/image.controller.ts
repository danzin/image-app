import { Request, Response, NextFunction } from "express";
import { ImageService } from "../services/image.service";
import { createError } from "../utils/errors";
import { errorLogger } from "../utils/winston";
import { inject, injectable } from "tsyringe";

/**
 * When using Dependency Injection in Express, there's a common
 * issue with route handles and `this` binding. When Express calls the route handlers,
 * it changes the context of `this`. So when I initialize the dependncy inside the constructor
 * like this.userService = userService, `this` context is lost and this.userService is undefined.
 *
 * 2 possible fixes:
 *  1 - manually bind all methods that will be used as route handlers:
 *     - this.register = this.register.bind(this);
 *     - etc etc, for every single method
 *  2 - user arrow functions, which automatically bind `this` and it doesn't get lost.
 */

@injectable()
export class ImageController {
  constructor(
    @inject("ImageService") private readonly imageService: ImageService
  ) {}

  uploadImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { decodedUser, file } = req;

      console.log(req.body.tags);
      const tags = JSON.parse(req.body.tags);

      if (!file) {
        throw createError("ValidationError", "No file uploaded");
      }

      const result = await this.imageService.uploadImage(
        decodedUser.id,
        file.buffer,
        tags
      );
      res.status(201).json(result);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  };

  getImages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 9;
    try {
      const images = await this.imageService.getImages(page, limit);
      res.header("Access-Control-Allow-Origin", "http://localhost:5173"); //specific origin
      res.header("Access-Control-Allow-Credentials", "true"); //allow credentials
      res.json(images);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  };

  getUserImages = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const { id } = req.params;

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    console.log("ID of getUserImages: ", id);
    try {
      const images = await this.imageService.getUserImages(id, page, limit);
      console.log(`images of user ${id}: ${images}`);
      res.json(images);
    } catch (error) {
      errorLogger.error(error.stack);
      next(createError("UnknownError", "Failed to fetch images"));
    }
  };

  getImageById = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.imageService.getImageById(id);
      res.json(result);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  };

  searchByTags = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { tags } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      console.log("tags in the controller:", tags);
      // Will leave empty tags allowed for now
      const tagArray = tags
        ? (tags as string).split(",").filter((tag) => tag.trim() !== "")
        : [];
      console.log(tagArray);
      // Call the service method
      const result = await this.imageService.searchByTags(
        tagArray,
        page,
        limit
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteImage = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await this.imageService.deleteImage(id);
      res.status(200).json(result);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  };

  getTags = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const result = await this.imageService.getTags();
      res.json(result);
    } catch (error) {
      next(createError(error.name, error.message));
    }
  };
}
