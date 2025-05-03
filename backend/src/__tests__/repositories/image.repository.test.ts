import "reflect-metadata";

import { jest, describe, beforeEach, it, expect } from "@jest/globals";
import { ImageRepository } from "../../repositories/image.repository";
import { ClientSession, Types } from "mongoose";
import { IImage, PaginationOptions } from "../../types";

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
};

const TAGS = ["art", "photo", "nature", "digita", "cats"];
const randomTag = () => TAGS[Math.floor(Math.random() * TAGS.length)];

function generateRandomObjectId() {
  return new Types.ObjectId();
}

function generateMockData(
  index: number,
  overrides?: Partial<IImage> // Allows for adding overrides to the objects.
): IImage {
  const defaults: IImage = {
    _id: generateRandomObjectId(),
    url: `image-${index}.jpg`,
    publicId: `pid-${index}`,
    user: { id: `user-${index}`, username: `user${index}` },
    tags: [{ tag: randomTag() }],
    createdAt: new Date(),
    likes: 0,
  } as unknown as IImage;

  return { ...defaults, ...overrides } as IImage;
}

function createMockImage(partial: Partial<IImage>): IImage {
  return {
    _id: partial._id || generateRandomObjectId(),
    url: partial.url || "default.jpg",
    publicId: partial.publicId || "default-public-id",
    user: partial.user || { id: "default-user-id", username: "defaultuser" },
    tags: partial.tags || [],
    createdAt: partial.createdAt || new Date(),
    likes: partial.likes || 0,
    // Might need stub Mongoose methods at some point, so I should keep in mind I may need to add some of them later
  } as unknown as IImage; // Cast to IImage to satisfy TypeScript
}

function generateMockImages(
  howMany: number,
  overrides?: Partial<IImage>
): IImage[] {
  return Array.from({ length: howMany }, (_, index) => {
    const data = generateMockData(index, overrides);
    return createMockImage(data);
  });
}

describe("ImageRepository", () => {
  let repository: ImageRepository;

  beforeEach(() => {
    // Reset mocks to avoid test interference
    jest.clearAllMocks();
    // Fresh repository instance with the mocked model
    repository = new ImageRepository(mockModel as any);
  });

  describe("findById", () => {
    it("throws ValidationError for invalid ObjectId", async () => {
      const invalidId = "invalid-id";
      await expect(repository.findById(invalidId)).rejects.toThrow(
        "Invalid image ID"
      );
      expect(mockModel.findById).not.toHaveBeenCalled();
    });

    it("throws DatabaseError on failure", async () => {
      const validId = "60f6a6a3c9b3a40015f0a9b6";
      jest.spyOn(mockModel, "findById").mockImplementation(() => {
        throw new Error("Database connection failed");
      });
      await expect(repository.findById(validId)).rejects.toThrow(
        "Database connection failed"
      );
    });

    it("returns an image with populated fields for valid ID", async () => {
      const mockImage: IImage = generateMockImages(1)[0];
      const mockId = mockImage._id as string;

      const mockQuery = {
        populate: jest.fn().mockReturnThis(), // mockReturnThis() allows for chaining
        session: jest.fn().mockReturnThis(),
        exec: jest
          .fn<() => Promise<Partial<IImage> | null>>()
          .mockResolvedValue(mockImage), // ALWAYS Provide a return value for the mock function or else TS frowns upon it
      };
      mockModel.findById.mockReturnValue(mockQuery);

      const result = await repository.findById(mockId);
      expect(result).toEqual(mockImage);
      expect(mockModel.findById).toHaveBeenCalledWith(mockId);
      expect(mockQuery.populate).toHaveBeenCalledWith("user", "username");
      expect(mockQuery.populate).toHaveBeenCalledWith("tags", "tag");
      expect(mockQuery.exec).toHaveBeenCalled();
    });

    it("uses session if provided", async () => {
      const mockSession = {} as ClientSession;
      const mockImage = generateMockImages(1)[0]; // When only one image is generated, it still returns an array with 1 element. Need to grab it right away.
      const mockId = mockImage._id;
      console.log(`mockImage: ${mockId}`);
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockReturnThis(),
        exec: jest
          .fn<() => Promise<Partial<IImage> | null>>()
          .mockResolvedValue(mockImage), // Provide a return value for the mock function or else TS frowns upon it
      };

      mockModel.findById.mockReturnValue(mockQuery);

      const result = await repository.findById(mockId as string, mockSession);
      expect(result).toEqual(mockImage);
      expect(mockQuery.session).toHaveBeenCalledWith(mockSession);
    });

    it("throws DatabaseError on failure", async () => {
      const validId = generateRandomObjectId();
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockReturnThis(),
        exec: jest
          .fn<() => Promise<Partial<IImage> | null>>()
          .mockRejectedValue(new Error("DatabaseError")), // Provide a return value for the mock function or else TS frowns upon it
      };
      mockModel.findById.mockReturnValue(mockQuery);

      await expect(repository.findById(validId.toString())).rejects.toThrow(
        "DatabaseError"
      );
    });
  });

  describe("findWithPagination", () => {
    it("returns images with default pagination options", async () => {
      const mockImages = generateMockImages(5);
      console.log(mockImages);
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
      const countExecMock = jest
        .fn<() => Promise<number>>()
        .mockResolvedValue(totalCount);
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
      expect(mockQuery.populate).toHaveBeenCalledWith("user", "username");
      expect(mockQuery.populate).toHaveBeenCalledWith("tags", "tag");
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: "desc" });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(mockModel.countDocuments).toHaveBeenCalled();
      expect(countExecMock).toHaveBeenCalled(); // Check if .exec() was called on countQuery
    });
  });

  describe("findByUserId", () => {
    it("returns images uploaded by a specific user with pagination support", async () => {
      const mockUserId = generateRandomObjectId();
      const mockImages = generateMockImages(5, {
        user: { id: mockUserId as any, username: "testuser" },
      });
      const totalCount = 5;

      // Mock the find query
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        exec: jest.fn<() => Promise<IImage[]>>().mockResolvedValue(mockImages),
      };

      mockModel.find.mockReturnValue(mockQuery);

      // Count query

      const countExecMock = jest
        .fn<() => Promise<number>>()
        .mockResolvedValue(totalCount);
      mockModel.countDocuments.mockReturnValue({
        exec: countExecMock,
      });

      const options: PaginationOptions = {};
      const result = await repository.findByUserId(
        mockUserId.toString(),
        options
      );

      expect(result).toEqual({
        data: mockImages,
        total: totalCount,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      expect(mockModel.find).toHaveBeenCalledWith({
        user: mockUserId.toString(),
      });
      expect(mockQuery.populate).toHaveBeenCalledWith("user", "username");
      expect(mockQuery.populate).toHaveBeenCalledWith("tags", "tag");
      expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: "desc" });
      expect(mockQuery.skip).toHaveBeenCalledWith(0);
      expect(mockQuery.limit).toHaveBeenCalledWith(20);
      expect(mockQuery.exec).toHaveBeenCalled();
      expect(mockModel.countDocuments).toHaveBeenCalledWith({
        user: mockUserId.toString(),
      });
      expect(countExecMock).toHaveBeenCalled();
    });

    it("throws DatabaseError on failure", async () => {
      const validId = generateRandomObjectId();
      const mockQuery = {
        populate: jest.fn().mockReturnThis(),
        session: jest.fn().mockReturnThis(),
        exec: jest
          .fn<() => Promise<Partial<IImage> | null>>()
          .mockRejectedValue(new Error("DatabaseError")), // Provide a return value for the mock function or else TS frowns upon it
      };
      mockModel.findById.mockReturnValue(mockQuery);

      await expect(repository.findById(validId.toString())).rejects.toThrow(
        "DatabaseError"
      );
    });
  });
});
