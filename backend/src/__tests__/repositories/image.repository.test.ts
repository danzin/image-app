import 'reflect-metadata';

import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ImageRepository } from '../../repositories/image.repository';
import { Model, ClientSession } from 'mongoose';
import { IImage, PaginationOptions, PaginationResult } from '../../types';
import { createError } from '../../utils/errors';

interface MockImageModel {
  findById: jest.Mock;
  find: jest.Mock;
  countDocuments: jest.Mock;
  deleteMany: jest.Mock;
  aggregate: jest.Mock;
}

const mockModel: MockImageModel = {
  findById: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
  deleteMany: jest.fn(),
  aggregate: jest.fn(),

} 



describe('ImageRepository', () => {
  let repository: ImageRepository;

  beforeEach(() => {
    // Reset mocks to avoid test interference
    jest.clearAllMocks();
    // Fresh repository instance with the mocked model
    repository = new ImageRepository(mockModel as any);
    
  });

  describe('findById', () => {
    it('returns null for invalid ObjectId', async () => {
      const invalidId = 'invalid-id';
      const result = await repository.findById(invalidId);
      expect(result).toBeNull();
      expect(mockModel.findById).not.toHaveBeenCalled();
    });

    it('returns an image with populated fields for valid ID', async () => {
      const validId = '60f6a6a3c9b3a40015f0a9b6';
      const mockImage: Partial<IImage> = {
        _id: validId,
        url: 'test.jpg',
        publicId: 'test-public-id',
        user: { id: '1' as any, username: 'testuser' },
        tags: [{ tag: 'art' }],
        createdAt: new Date(),
        likes: 0,
      };

      const mockQuery = {
        populate: jest.fn().mockReturnThis(), // mockReturnThis() allows for chaining support
        session: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<Partial<IImage> | null>>().mockResolvedValue(mockImage), // ALWAYS Provide a return value for the mock function or else TS frowns upon it
        };
      mockModel.findById.mockReturnValue(mockQuery);

      const result = await repository.findById(validId);
      expect(result).toEqual(mockImage);
      expect(mockModel.findById).toHaveBeenCalledWith(validId);
      expect(mockQuery.populate).toHaveBeenCalledWith('user', 'username');
      expect(mockQuery.populate).toHaveBeenCalledWith('tags', 'tag');
      expect(mockQuery.exec).toHaveBeenCalled();
    });

    it('uses session if provided', async () => {
      const validId = '60f6a6a3c9b3a40015f0a9b6';
      const mockSession = {} as ClientSession;
      const mockImage = { _id: validId, url: 'test.jpg' } as IImage;

      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<Partial<IImage> | null>>().mockResolvedValue(mockImage),  // Provide a return value for the mock function or else TS frowns upon it
        };
      mockModel.findById.mockReturnValue(mockQuery);

      const result = await repository.findById(validId, mockSession);
      expect(result).toEqual(mockImage);
      expect(mockQuery.session).toHaveBeenCalledWith(mockSession);
    });

    it('throws DatabaseError on failure', async () => {
      const validId = '60f6a6a3c9b3a40015f0a9b6';
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<Partial<IImage> | null>>().mockRejectedValue(new Error('DatabaseError')), // Provide a return value for the mock function or else TS frowns upon it
      };
      mockModel.findById.mockReturnValue(mockQuery);

      await expect(repository.findById(validId)).rejects.toThrow('DatabaseError');
    });
  });

  describe('findWithPagination', () => {
    it('returns images with default pagination options', async () => {

      const mockImages = [
        {
          _id: '1',
          url: 'test1.jpg',
          publicId: 'test1-public-id',
          user: { id: '1' as any, username: 'testuser1' },
          tags: [{ tag: 'art' }],
          createdAt: new Date(),
          likes: 0,
        },
        {
          _id: '2',
          url: 'test2.jpg',
          publicId: 'test2-public-id',
          user: { id: '2' as any, username: 'testuser2' },
          tags: [{ tag: 'photo' }],
          createdAt: new Date(),
          likes: 1,
        },
      ] as IImage[];
    
      const totalCount = 5;
    
      // find query
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<IImage[]>>().mockResolvedValue(mockImages),
      };
      mockModel.find.mockReturnValue(mockQuery);
    
      // count query
      const countExecMock = jest.fn<() => Promise<number>>().mockResolvedValue(totalCount);
      mockModel.countDocuments.mockReturnValue({
        session: jest.fn().mockReturnThis(),
        exec: countExecMock,
      });
    
      const options: PaginationOptions = {};
      const result = await repository.findWithPagination(options);
    
      expect(result).toEqual({
        data: mockImages,
        total: totalCount,
        page: 1,
        limit: 20,
        totalPages: Math.ceil(totalCount / 20),
      });
    
 
      expect(mockModel.find).toHaveBeenCalled();
      expect(mockQuery.populate).toHaveBeenCalledWith('user', 'username');
      expect(mockQuery.populate).toHaveBeenCalledWith('tags', 'tag');
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: 'desc' });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(mockModel.countDocuments).toHaveBeenCalled();
      expect(countExecMock).toHaveBeenCalled(); // Check if .exec() was called on countQuery
    });


  })

})