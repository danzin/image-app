import "reflect-metadata";

import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";
import { ImageRepository } from "../../repositories/image.repository";
import { ClientSession, Model, Types } from "mongoose";
import { IImage, PaginationOptions } from "../../types";

chai.use(chaiAsPromised);

interface MockImageModel {
  findById: SinonStub;
  find: SinonStub;
  countDocuments: SinonStub;
  deleteMany: SinonStub;
  aggregate: SinonStub;
  findByIdAndUpdate: SinonStub;
  findOneAndDelete: SinonStub;
  findOneAndUpdate: SinonStub;

  save: SinonStub;
}

const TAGS = ["art", "photo", "nature", "digita", "cats"];
const randomTag = () => TAGS[Math.floor(Math.random() * TAGS.length)];

function generateRandomObjectId() {
  return new Types.ObjectId();
}

function generateMockData(
  index: number,
  overrides?: Partial<IImage>
): Partial<IImage> {
  const defaults: Partial<IImage> = {
    _id: generateRandomObjectId(),
    url: `image-${index}.jpg`,
    publicId: `pid-${index}`,
    user: { id: `user-${index}`, username: `user${index}` } as any,
    tags: [{ tag: randomTag() } as any],
    createdAt: new Date(),
    likes: 0,
  };
  return { ...defaults, ...overrides };
}

function createMockImage(partial: Partial<IImage>): Partial<IImage> {
  return {
    _id: partial._id || generateRandomObjectId(),
    url: partial.url || "default.jpg",
    publicId: partial.publicId || "default-public-id",
    user: partial.user || {
      id: generateRandomObjectId(),
      username: "defaultuser",
    },
    tags: partial.tags || [],
    createdAt: partial.createdAt || new Date(),
    likes: partial.likes || 0,
  } as unknown as Partial<IImage>;
}

function generateMockImages(
  howMany: number,
  overrides?: Partial<IImage>
): Partial<IImage>[] {
  return Array.from({ length: howMany }, (_, index) => {
    const data = generateMockData(index, overrides);
    return createMockImage(data);
  });
}

describe("ImageRepository", () => {
  let repository: ImageRepository;
  let mockModel: MockImageModel;
  let mockSession: ClientSession;

  beforeEach(() => {
    mockModel = {
      findById: sinon.stub(),
      find: sinon.stub(),
      countDocuments: sinon.stub(),
      deleteMany: sinon.stub(),
      aggregate: sinon.stub(),
      findByIdAndUpdate: sinon.stub(),
      findOneAndDelete: sinon.stub(),
      findOneAndUpdate: sinon.stub(),
      save: sinon.stub(),
    };

    mockSession = {} as ClientSession;

    repository = new ImageRepository(mockModel as any as Model<IImage>);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("findById", () => {
    it("should throw ValidationError for invalid ObjectId", async () => {
      const invalidId = "invalid-id";

      try {
        await repository.findById(invalidId);
        throw new Error("Excpect findById to throw");
      } catch (err) {
        expect(err.name).to.equal("ValidationError");
        expect(err.message).to.equal("Invalid image ID");
        expect(mockModel.findById.called).to.be.false;
      }
    });

    it("should throw DatabaseError on underlying model failure", async () => {
      const validId = generateRandomObjectId().toString();
      const dbError = new Error("Database connection failed");

      const mockQuery = {
        populate: sinon.stub().returnsThis(),
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(dbError),
      };
      mockModel.findById.returns(mockQuery);

      await expect(repository.findById(validId)).to.be.rejectedWith(
        "Database connection failed"
      );
      expect(mockModel.findById.calledWith(validId)).to.be.true;
      expect(mockQuery.exec.calledOnce).to.be.true;
    });

    it("should return an image with populated fields for valid ID", async () => {
      const mockImage = createMockImage(generateMockData(1)) as IImage;
      const mockId = mockImage._id as string;

      const mockQuery = {
        populate: sinon.stub().returnsThis(),
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockImage),
      };
      mockModel.findById.withArgs(mockId).returns(mockQuery);

      const result = await repository.findById(mockId);

      expect(result).to.deep.equal(mockImage);
      expect(mockModel.findById.calledOnceWith(mockId)).to.be.true;
      expect(mockQuery.populate.calledWith("user", "username")).to.be.true;
      expect(mockQuery.populate.calledWith("tags", "tag")).to.be.true;
      expect(mockQuery.exec.calledOnce).to.be.true;

      expect(mockQuery.session.called).to.be.false;
    });

    it("should use session if provided", async () => {
      const mockImage = createMockImage(generateMockData(1)) as IImage;
      const mockId = mockImage._id as string;

      const mockQuery = {
        populate: sinon.stub().returnsThis(),
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockImage),
      };
      mockModel.findById.withArgs(mockId).returns(mockQuery);

      const result = await repository.findById(mockId, mockSession);

      expect(result).to.deep.equal(mockImage);
      expect(mockModel.findById.calledOnceWith(mockId)).to.be.true;
      expect(mockQuery.session.calledOnceWith(mockSession)).to.be.true;
      expect(mockQuery.exec.calledOnce).to.be.true;
    });

    it("should return null if image not found", async () => {
      const validId = generateRandomObjectId().toString();

      const mockQuery = {
        populate: sinon.stub().returnsThis(),
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(null),
      };
      mockModel.findById.withArgs(validId).returns(mockQuery);

      const result = await repository.findById(validId);

      expect(result).to.be.null;
      expect(mockModel.findById.calledOnceWith(validId)).to.be.true;
      expect(mockQuery.exec.calledOnce).to.be.true;
    });
  });

  describe("findWithPagination", () => {
    it("should return images with default pagination options", async () => {
      const mockImages = generateMockImages(5) as IImage[];
      const totalCount = 5;
      const options: PaginationOptions = {};
      const expectedPage = 1;
      const expectedLimit = 20;

      const mockAggregateQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockImages),
      };
      mockModel.aggregate.returns(mockAggregateQuery);

      const mockCountQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(totalCount),
      };
      mockModel.countDocuments.returns(mockCountQuery);

      const result = await repository.findWithPagination(options);

      expect(result).to.deep.equal({
        data: mockImages,
        total: totalCount,
        page: expectedPage,
        limit: expectedLimit,
        totalPages: Math.ceil(totalCount / expectedLimit),
      });

      expect(mockModel.aggregate.calledOnce).to.be.true;
      expect(mockAggregateQuery.exec.calledOnce).to.be.true;

      expect(mockModel.countDocuments.calledOnce).to.be.true;
      expect(mockCountQuery.session.called).to.be.false;
      expect(mockCountQuery.exec.calledOnce).to.be.true;
    });

    it("should use provided pagination options and session", async () => {
      const mockImages = generateMockImages(3) as IImage[];
      const totalCount = 15;
      const options: PaginationOptions = {
        page: 2,
        limit: 5,
        sortBy: "likes",
        sortOrder: "asc",
      };

      const mockAggregateQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockImages),
      };
      mockModel.aggregate.returns(mockAggregateQuery);

      const mockCountQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(totalCount),
      };
      mockModel.countDocuments.returns(mockCountQuery);

      const result = await repository.findWithPagination(options, mockSession);

      expect(result).to.deep.equal({
        data: mockImages,
        total: totalCount,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(totalCount / options.limit!),
      });

      expect(mockModel.aggregate.calledOnce).to.be.true;
      expect(mockAggregateQuery.session.calledOnceWith(mockSession)).to.be.true;
      expect(mockAggregateQuery.exec.calledOnce).to.be.true;

      expect(mockModel.countDocuments.calledOnce).to.be.true;
      expect(mockCountQuery.session.calledOnceWith(mockSession)).to.be.true;
      expect(mockCountQuery.exec.calledOnce).to.be.true;
    });

    it("should throw DatabaseError on find query failure", async () => {
      const dbError = new Error("DatabaseError");
      const options: PaginationOptions = {};

      const mockAggregateQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(dbError), // Aggregate query fails
      };
      mockModel.aggregate.returns(mockAggregateQuery);

      const mockCountQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(10),
      };
      mockModel.countDocuments.returns(mockCountQuery);

      await expect(repository.findWithPagination(options)).to.be.rejectedWith(
        "DatabaseError"
      );

      // countDocuments is also called since it's in Promise.all
      expect(mockCountQuery.exec.called).to.be.true;
    });

    it("should throw DatabaseError on count query failure", async () => {
      const dbError = new Error("Count failed");
      const options: PaginationOptions = {};

      const mockAggregateQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([]),
      };
      mockModel.aggregate.returns(mockAggregateQuery);

      const mockCountQuery = {
        session: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(dbError),
      };
      mockModel.countDocuments.returns(mockCountQuery);

      await expect(repository.findWithPagination(options)).to.be.rejectedWith(
        "Count failed"
      );
    });
  });

  describe("findByUserId", () => {
    it("should return images for a user with default pagination", async () => {
      const mockUserId = generateRandomObjectId();
      const mockUserIdString = mockUserId.toString();
      const mockImages = generateMockImages(5, {
        user: { publicId: mockUserId as any, username: "testuser", avatar: "test-avatar.jpg" },
      }) as IImage[];
      const totalCount = 5;
      const options: PaginationOptions = {};
      const expectedPage = 1;
      const expectedLimit = 20;
      const filter = { user: mockUserIdString };

      const mockFindQuery = {
        populate: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockImages),
      };
      mockModel.find.withArgs(filter).returns(mockFindQuery);

      const mockCountQuery = {
        exec: sinon.stub().resolves(totalCount),
      };
      mockModel.countDocuments.withArgs(filter).returns(mockCountQuery);

      const result = await repository.findByUserId(mockUserIdString, options);

      expect(result).to.deep.equal({
        data: mockImages,
        total: totalCount,
        page: expectedPage,
        limit: expectedLimit,
        totalPages: Math.ceil(totalCount / expectedLimit),
      });

      expect(mockModel.find.calledOnceWith(filter)).to.be.true;
      expect(mockFindQuery.populate.calledWith("user", "username")).to.be.true;
      expect(mockFindQuery.populate.calledWith("tags", "tag")).to.be.true;
      expect(mockFindQuery.sort.calledOnceWith({ createdAt: "desc" })).to.be
        .true;
      expect(mockFindQuery.skip.calledOnceWith(0)).to.be.true;
      expect(mockFindQuery.limit.calledOnceWith(expectedLimit)).to.be.true;
      expect(mockFindQuery.exec.calledOnce).to.be.true;

      expect(mockModel.countDocuments.calledOnceWith(filter)).to.be.true;
      expect(mockCountQuery.exec.calledOnce).to.be.true;
    });

    it("should apply custom pagination options for findByUserId", async () => {
      const mockUserId = generateRandomObjectId().toString();
      const mockImages = generateMockImages(2) as IImage[];
      const totalCount = 8;
      const options: PaginationOptions = {
        page: 3,
        limit: 3,
        sortBy: "likes",
        sortOrder: "asc",
      };
      const filter = { user: mockUserId };
      const expectedSkip = (options.page! - 1) * options.limit!;

      const mockFindQuery = {
        populate: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(mockImages),
      };
      mockModel.find.withArgs(filter).returns(mockFindQuery);

      const mockCountQuery = {
        exec: sinon.stub().resolves(totalCount),
      };
      mockModel.countDocuments.withArgs(filter).returns(mockCountQuery);

      const result = await repository.findByUserId(mockUserId, options);

      expect(result).to.deep.equal({
        data: mockImages,
        total: totalCount,
        page: options.page,
        limit: options.limit,
        totalPages: Math.ceil(totalCount / options.limit!),
      });

      expect(mockModel.find.calledOnceWith(filter)).to.be.true;
      expect(
        mockFindQuery.sort.calledOnceWith({
          [options.sortBy!]: options.sortOrder,
        })
      ).to.be.true;
      expect(mockFindQuery.skip.calledOnceWith(expectedSkip)).to.be.true;
      expect(mockFindQuery.limit.calledOnceWith(options.limit)).to.be.true;
      expect(mockFindQuery.exec.calledOnce).to.be.true;

      expect(mockModel.countDocuments.calledOnceWith(filter)).to.be.true;
      expect(mockCountQuery.exec.calledOnce).to.be.true;
    });

    it("should throw DatabaseError on findByUserId failure", async () => {
      const mockUserId = generateRandomObjectId().toString();
      const options: PaginationOptions = {};
      const dbError = new Error("DB error during findByUserId");
      const filter = { user: mockUserId };

      const mockFindQuery = {
        populate: sinon.stub().returnsThis(),
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        exec: sinon.stub().rejects(dbError),
      };
      mockModel.find.withArgs(filter).returns(mockFindQuery);

      const mockCountQuery = {
        exec: sinon.stub().resolves(0),
      };
      mockModel.countDocuments.withArgs(filter).returns(mockCountQuery);

      await expect(
        repository.findByUserId(mockUserId, options)
      ).to.be.rejectedWith(dbError.message);
    });
  });
});
