import { NextFunction, Request, Response } from "express";
import { ImageController } from "../../controllers/image.controller";
import { ImageService } from "../../services/image.service";
import { UserService } from "../../services/user.service";
import { IUser } from "../../models/user.model";
import { createError } from "../../utils/errors";



jest.mock('../../services/image.service.ts');

describe('ImageController', () => {

  let imageController: ImageController;
  let imageService: jest.Mocked<ImageService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    imageService = new ImageService() as jest.Mocked<ImageService>
    imageController = new ImageController();
    imageController['imageService'] = imageService;

    //req props for testing
    req = {
      decodedUser: { id: 'user-id' },
      file: { 
        buffer: Buffer.from('mock-buffer') 
      } as Partial<Express.Multer.File>,
      query: {
        page: '1',
        limit: '20',
      },
      params: {
        userId: 'user-id',
        id: 'image-id',
      },
    } as Partial<Request>;


    //res props for testing
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),

    } as Partial<Response>;

    next = jest.fn();
  
  });


  describe('upploadImage', () => {
    it('should upload an image successfully', async () => {
      const mockResult = { url: 'http://example.com/image.jpg' };
      imageService.uploadImage.mockResolvedValueOnce(mockResult);

      await imageController.uploadImage(req as Request, res as Response, next);

      expect(imageService.uploadImage).toHaveBeenCalledWith('user-id', Buffer.from('mock-buffer'));
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle errors', async () => {
      const error = new Error('Upload failed');
      imageService.uploadImage.mockRejectedValueOnce(error);

      await imageController.uploadImage(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(createError(error.name, error.message));
    });
  });

  describe('getImages', () => {
    it('should return paginated images successfully', async () => {
      const mockImages = [{ _id: '1', url: 'http://test.com/image1.jpg' }];
      const mockResult = {
        data: mockImages,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };

      imageService.getImages.mockResolvedValueOnce(mockResult);
      await imageController.getImages(req as Request, res as Response, next);

      expect(imageService.getImages).toHaveBeenCalledWith(1, 20);
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://localhost:5173');
      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Credentials', 'true');
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to fetch images');
      imageService.getImages.mockRejectedValueOnce(error);
      await imageController.getImages(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(createError(error.name, error.message));
    });
  });

  describe('getUserImages', () => {
    it('should return user images successfully', async () => {
      const mockImages = [{ _id: '1', url: 'http://example.com/image1.jpg' }];
      const mockResult = {
        data: mockImages,
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      imageService.getUserImages.mockResolvedValueOnce(mockResult as any);

      await imageController.getUserImages(req as Request, res as Response, next);

      expect(imageService.getUserImages).toHaveBeenCalledWith('user-id', 1, 20);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to fetch images');
      imageService.getUserImages.mockRejectedValueOnce(error);

      await imageController.getUserImages(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(createError(error.name, error.message));
    });
  });

  describe('getImageById', () => {
    it('should return image by id successfully', async () => {
      const mockImage = { _id: 'image-id', url: 'http://example.com/image1.jpg' };
      imageService.getImageById.mockResolvedValueOnce(mockImage);

      await imageController.getImageById(req as Request, res as Response, next);

      expect(imageService.getImageById).toHaveBeenCalledWith('image-id');
      expect(res.json).toHaveBeenCalledWith(mockImage);
    });

    it('should handle errors', async () => {
      const error = new Error('Failed to fetch image by id');
      imageService.getImageById.mockRejectedValueOnce(error);

      await imageController.getImageById(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(createError(error.name, error.message));
    });
  });

})