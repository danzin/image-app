import { ImageRepository, PaginationResult } from "../../repositories/image.repository.old";
import { UserRepository } from "../../repositories/user.repository.old";
import { ImageService } from "../../services/image.service.old";
import { IImage } from "../../types";
import CloudinaryService from "../../services/cloudinary.service";
import { UploadApiResponse } from "cloudinary";
import { IUser } from "../../types"
import { createError } from "../../utils/errors";

jest.mock('../../repositories/image.repository.ts');
jest.mock('../../services/cloudinary.service.ts');
jest.mock('../../repositories/user.repository.ts');

describe('ImageService', () => {
  let imageService: ImageService;
  let imageRepository: jest.Mocked<ImageRepository>;
  let userRepository: jest.Mocked<UserRepository>;
  let cloudinaryService: jest.Mocked<CloudinaryService>;


  let mockImage: Partial<IImage>;
  let mockUser: Partial<IUser>;
  let mockResult: PaginationResult<IImage>;
  beforeEach(() => {
    imageRepository = new ImageRepository() as jest.Mocked<ImageRepository>;
    cloudinaryService = new CloudinaryService() as jest.Mocked<CloudinaryService>;
    userRepository = new UserRepository() as jest.Mocked<UserRepository>;
    imageService = new ImageService();

    //inject mocked dependencies
    imageService['imageRepository'] = imageRepository;
    imageService['userRepository'] = userRepository;
    imageService['cloudinaryService'] = cloudinaryService
    
    //mock image
    mockImage = {
      _id: 'test-id',
      url: 'http://test.com/image.jpg',
      userId: 'user-id',
      createdAt: new Date(),
      tags: ['cat'],
      uploadedBy: 'test-uname'
    };
  
    mockUser = {
      _id: 'test-id',
      username: 'test-uname',
      email: 'test-email',
      password: 'test-password',
      createdAt: new Date(),
      updatedAt: new Date(),
      images: [],
      isAdmin: false,
      comparePassword: jest.fn(),
    };
      
    mockResult = { 
        data: mockImage as IImage,
        total: 1,
        page: 1,
        limit: 1,
        totalPages: 1
      };

  });

  describe('uploadImage', () => {
    it('should upload an image successfully', async () => {
      const mockUploadResult = { url: 'http://example.com/image.jpg' };
      
      cloudinaryService.uploadImage.mockResolvedValueOnce(mockUploadResult as UploadApiResponse);
      imageRepository.create.mockResolvedValueOnce(mockImage as IImage);
      userRepository.findById.mockResolvedValueOnce(mockUser as IUser);

      const result = await imageService.uploadImage('user-id', 'image-data' as any, ['cat']);

      expect(result).toEqual(mockImage);
      expect(cloudinaryService.uploadImage).toHaveBeenCalledWith('image-data');
      expect(imageRepository.create).toHaveBeenCalledWith({
        url: mockUploadResult.url,
        userId: 'user-id',
        tags: ['cat']
      });
    
    });

    it('should handle errors during image upload', async () => {
      const error = new Error('Upload failed');
      userRepository.findById.mockResolvedValueOnce(mockUser as IUser);

      cloudinaryService.uploadImage.mockRejectedValueOnce(error);
      
      await expect(imageService.uploadImage('user-id', 'image-data' as any, ['cat'])).rejects.toThrow('Upload failed');
    });

  });

  describe('getImages', () => {
    it('should return paginated images', async() => {
      
      imageRepository.findImages.mockResolvedValueOnce(mockResult);
    
      const result = await imageService.getImages(1, 1);

      expect(result).toEqual(mockResult);
      expect(imageRepository.findImages).toHaveBeenCalledWith({ page: 1, limit: 1 });
    });
    
    it('should handle errors', async () => {
      const error = new Error('Failed to fetch images');
      imageRepository.findImages.mockRejectedValueOnce(error);

      await expect(imageService.getImages(1, 1)).rejects.toThrow('Failed to fetch images');
    });


  });

  describe('getImageById', ()=>{
    it('should return image by ID', async () => {

      imageRepository.findById.mockResolvedValueOnce(mockImage as IImage);

      const result = await imageService.getImageById(mockImage._id as string);
      expect(result).toEqual(mockImage);
      expect(imageRepository.findById).toHaveBeenCalledWith(mockImage._id);
    });

    it('should throw errors', async () => {
      const error = new Error('Image not found');
      imageRepository.findById.mockRejectedValueOnce(error);

      await expect(imageService.getImageById(mockImage._id as string)).rejects.toThrow('Image not found')
    });

    
  });

  describe('getUserImages', () => {
    it('should return paginated images by userId', async () => {
      imageRepository.getByUserId.mockResolvedValueOnce(mockResult);

      const result = await imageService.getUserImages(mockUser._id as string, 1, 1);
      expect(result).toEqual(mockResult);
      expect(imageRepository.getByUserId).toHaveBeenCalledWith(mockUser._id, {page: 1, limit: 1})
    })
  });

  describe('searchByTags', () => {
    it('should return images filtered by tags with pagination', async () => {
      const mockTags = ['cat', 'cute'];
      const mockPage = 1;
      const mockLimit = 10;
      const mockResult: PaginationResult<IImage> = {
        data: [
          { _id: '1', tags: ['cat', 'cute'], url: 'image1.jpg', userId: 'user-id', createdAt: new Date() },
          { _id: '2', tags: ['cat'], url: 'image2.jpg', userId: 'user-id', createdAt: new Date() },
        ] as any,
        total: 2,
        page: mockPage,
        limit: mockLimit,
        totalPages: 1,
      };
  
      imageRepository.searchByTags.mockResolvedValueOnce(mockResult);
  
      const result = await imageService.searchByTags(mockTags, mockPage, mockLimit);
  
      expect(imageRepository.searchByTags).toHaveBeenCalledWith(mockTags, mockPage, mockLimit);
      expect(result).toEqual(mockResult);
    });
  
  
    it('should throw an error if the repository throws an error', async () => {
      const mockTags = ['cat'];
      imageRepository.searchByTags.mockRejectedValueOnce(createError('InternalServerError','Database error'));
  
      await expect(imageService.searchByTags(mockTags, 1, 10)).rejects.toThrow('Database error');
      expect(imageRepository.searchByTags).toHaveBeenCalledWith(mockTags, 1, 10);
    });
  });
  

});