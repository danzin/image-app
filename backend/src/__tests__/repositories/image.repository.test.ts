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
        exec: jest.fn<() => Promise<Partial<IImage> | null>>().mockResolvedValue(mockImage),
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
        exec: jest.fn<() => Promise<Partial<IImage> | null>>().mockResolvedValue(mockImage), 
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
        exec: jest.fn<() => Promise<Partial<IImage> | null>>().mockRejectedValue(new Error('DatabaseError')),
      };
      mockModel.findById.mockReturnValue(mockQuery);

      await expect(repository.findById(validId)).rejects.toThrow('DatabaseError');
    });
  });

})