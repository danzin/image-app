import { ImageRepository } from '../../repositories/image.repository';
import Image from '../../models/image.model';


//mock the model
jest.mock('../../models/image.model');

describe('ImageRepository', () => {
  let repository: ImageRepository;
  
  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ImageRepository();
  });

  describe('create', () => {
    it('should create an image successfully', async () => {
      const mockImage = {
        _id: 'test-id',
        userId: 'user-id',
        url: 'test-url',
        createdAt: new Date()
      };
      
      (Image.create as jest.Mock).mockResolvedValueOnce(mockImage);
      
      const result = await repository.create(mockImage);
      
      expect(result).toEqual(mockImage);
      expect(Image.create).toHaveBeenCalledWith(mockImage);
    });

    it('should throw an error when creation fails', async () => {
      const error = new Error('InternalServerError');
      (Image.create as jest.Mock).mockRejectedValueOnce(error);
      
      await expect(repository.create({})).rejects.toThrow('InternalServerError');
    });
  });

  describe('findImages', () => {
    it('should return paginated results with default options', async () => {
      const mockImages = [{ _id: '1' }, { _id: '2' }];
      const mockExec = jest.fn().mockResolvedValueOnce(mockImages);
      const mockSort = jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: mockExec }) }) });
      const mockFind = jest.fn().mockReturnValue({ sort: mockSort });
      
      (Image.find as jest.Mock) = mockFind;
      (Image.countDocuments as jest.Mock).mockResolvedValueOnce(2);
      
      const result = await repository.findImages();
      
      expect(result).toEqual({
        data: mockImages,
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      });
    });

    it('should handle custom pagination options', async () => {
      const mockImages = [{ _id: '1' }];
      const mockExec = jest.fn().mockResolvedValueOnce(mockImages);
      const mockSort = jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: mockExec }) }) });
      const mockFind = jest.fn().mockReturnValue({ sort: mockSort });
      
      (Image.find as jest.Mock) = mockFind;
      (Image.countDocuments as jest.Mock).mockResolvedValueOnce(1);
      
      const result = await repository.findImages({
        page: 2,
        limit: 10,
        sortBy: 'url',
        sortOrder: 'asc'
      });
      
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(mockSort).toHaveBeenCalledWith({ url: 'asc' });
    });
  });

  describe('getByUserId', () => {
    it('should return user-specific paginated results', async () => {
      const userId = 'test-user';
      const mockImages = [{ _id: '1', userId }];
      const mockExec = jest.fn().mockResolvedValueOnce(mockImages);
      const mockSort = jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ exec: mockExec }) }) });
      const mockFind = jest.fn().mockReturnValue({ sort: mockSort });
      
      (Image.find as jest.Mock) = mockFind;
      (Image.countDocuments as jest.Mock).mockResolvedValueOnce(1);
      
      const result = await repository.getByUserId(userId);
      
      expect(result.data).toEqual(mockImages);
      expect(mockFind).toHaveBeenCalledWith({ userId });
    });
  });

  describe('delete', () => {
    it('should delete an image successfully', async () => {
      const mockId = 'test-id';
      (Image.findByIdAndDelete as jest.Mock).mockResolvedValueOnce(true);
      
      const result = await repository.delete(mockId);
      
      expect(result).toBe(true);
      expect(Image.findByIdAndDelete).toHaveBeenCalledWith(mockId);
    });
  });

  describe('deleteMany', () => {
    it('should delete multiple images by userId', async () => {
      const userId = 'test-user';
      (Image.deleteMany as jest.Mock).mockResolvedValueOnce({ acknowledged: true, deletedCount: 2 });
      
      const result = await repository.deleteMany(userId);
      
      expect(result).toBe(true);
      expect(Image.deleteMany).toHaveBeenCalledWith({ userId });
    });
  });

  describe('update', () => {
    it('should update an image successfully', async () => {
      const mockId = 'test-id';
      const updateData = { url: 'new-url' };
      const updatedImage = { _id: mockId, ...updateData };
      
      (Image.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce(updatedImage);
      
      const result = await repository.update(mockId, updateData);
      
      expect(result).toEqual(updatedImage);
      expect(Image.findByIdAndUpdate).toHaveBeenCalledWith(mockId, updateData, { new: true });
    });
  });

  describe('searchByTags', () => {
    it('should return images filtered by tags with pagination', async () => {
      const mockTags = ['cat', 'cute'];
      const mockPage = 1;
      const mockLimit = 10;
      const mockSkip = (mockPage - 1) * mockLimit;
  
      const mockImages = [
        { _id: '1', tags: ['cat', 'cute'], url: 'image1.jpg' },
        { _id: '2', tags: ['cat'], url: 'image2.jpg' },
      ];
  
      const mockTotalCount = 2;
  
      //Mock query object with chaining
      const mockFind = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValueOnce(mockImages),
      };
  
      (Image.find as jest.Mock).mockReturnValueOnce(mockFind);
      (Image.countDocuments as jest.Mock).mockResolvedValueOnce(mockTotalCount);
  
      const result = await repository.searchByTags(mockTags, mockPage, mockLimit);
  
      expect(Image.find).toHaveBeenCalledWith({ tags: { $in: mockTags } });
      expect(mockFind.skip).toHaveBeenCalledWith(mockSkip);
      expect(mockFind.limit).toHaveBeenCalledWith(mockLimit);
      expect(Image.countDocuments).toHaveBeenCalledWith({ tags: { $in: mockTags } });
  
      expect(result).toEqual({
        data: mockImages,
        total: mockTotalCount,
        page: mockPage,
        limit: mockLimit,
        totalPages: Math.ceil(mockTotalCount / mockLimit),
      });
    });
  });
  
  
});