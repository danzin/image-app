// import "reflect-metadata";

import { describe, beforeEach, afterEach, it } from "mocha";
import * as chai from "chai";
import { expect } from "chai";
import chaiAsPromised from "chai-as-promised";
import sinon, { SinonStub } from "sinon";
import { ClientSession, Model, Types } from "mongoose";
import { UserRepository } from "../../repositories/user.repository";
import { IUser, PaginationOptions, PaginationResult } from "../../types";

chai.use(chaiAsPromised);

interface MockUserDoc extends IUser {
  save: SinonStub;
  $session: SinonStub;
  _id: Types.ObjectId;
}

const createMockUserDocInstance = (userData: Partial<IUser>): MockUserDoc => {
  const instance = {
    ...userData,
    _id: userData._id || new Types.ObjectId(),
    save: sinon.stub(),
    $session: sinon.stub().returnsThis(),
  } as unknown as MockUserDoc;
  instance.save!.resolves(instance);
  return instance;
};

interface MockUserModelFunc extends SinonStub {
  findOneAndUpdate: SinonStub;
  findOne: SinonStub;
  findByIdAndUpdate: SinonStub;
  find: SinonStub;
  countDocuments: SinonStub;
}

describe("UserRepository", () => {
  let repository: UserRepository;
  let mockModel: MockUserModelFunc;
  let mockSession: ClientSession;
  let mockQuery: {
    session: SinonStub;
    select: SinonStub;
    sort: SinonStub;
    skip: SinonStub;
    limit: SinonStub;
    exec: SinonStub;
  };

  beforeEach(() => {
    mockQuery = {
      session: sinon.stub().returnsThis(),
      select: sinon.stub().returnsThis(),
      sort: sinon.stub().returnsThis(),
      skip: sinon.stub().returnsThis(),
      limit: sinon.stub().returnsThis(),
      exec: sinon.stub(),
    };

    mockModel = sinon.stub() as MockUserModelFunc;
    mockModel.findOneAndUpdate = sinon.stub().returns(mockQuery);
    mockModel.findOne = sinon.stub().returns(mockQuery);
    mockModel.findByIdAndUpdate = sinon.stub().returns(mockQuery);
    mockModel.find = sinon.stub().returns(mockQuery);
    mockModel.countDocuments = sinon.stub().returns(mockQuery); // Oor .resolves(value)

    mockModel.callsFake((data) => createMockUserDocInstance(data)); // Default constructor behavior

    mockSession = {} as ClientSession;
    repository = new UserRepository(mockModel as any as Model<IUser>);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("create", () => {
    const userData: Partial<IUser> = {
      username: "testuser",
      email: "test@example.com",
      password: "password123",
    };

    it("should create a new user successfully", async () => {
      const expectedDocInstance = createMockUserDocInstance(userData);

      mockModel.withArgs(userData).returns(expectedDocInstance);
      expectedDocInstance.save.resolves(expectedDocInstance as IUser);

      const result = await repository.create(userData);

      expect(mockModel.calledOnceWith(userData)).to.be.true; // mockModel is the constructor

      // The instance returned by the constructor call is `expectedDocInstance` due to `withArgs...returns`
      expect(expectedDocInstance.$session.called).to.be.false;
      expect(expectedDocInstance.save.calledOnce).to.be.true;
      expect(result).to.deep.equal(expectedDocInstance);
    });

    it("should create a user with a session if provided", async () => {
      const expectedDocInstance = createMockUserDocInstance(userData);
      mockModel.withArgs(userData).returns(expectedDocInstance);
      expectedDocInstance.save.resolves(expectedDocInstance as IUser);

      await repository.create(userData, mockSession);

      expect(mockModel.calledOnceWith(userData)).to.be.true;

      expect(expectedDocInstance.$session.calledOnceWith(mockSession)).to.be
        .true;
      expect(
        expectedDocInstance.$session.calledBefore(expectedDocInstance.save)
      ).to.be.true;
      expect(expectedDocInstance.save.calledOnce).to.be.true;
    });

    it("should throw DuplicateError for duplicate username (error code 11000)", async () => {
      const duplicateError: any = new Error("Duplicate key error");
      duplicateError.code = 11000;
      duplicateError.keyValue = { username: "testuser" };

      const expectedDocInstance = createMockUserDocInstance(userData);
      mockModel.withArgs(userData).returns(expectedDocInstance);
      expectedDocInstance.save.rejects(duplicateError);

      await expect(repository.create(userData))
        .to.be.rejectedWith("username already exists")
        .and.eventually.satisfy((err: any) => {
          expect(err.name).to.equal("DuplicateError");
          return true;
        });

      expect(mockModel.calledOnceWith(userData)).to.be.true;
      expect(expectedDocInstance.save.calledOnce).to.be.true;
    });

    it("should throw DuplicateError for duplicate email (error code 11000)", async () => {
      const duplicateError: any = new Error("Duplicate key error");
      duplicateError.code = 11000;
      duplicateError.keyValue = { email: "test@example.com" };

      const expectedDocInstance = createMockUserDocInstance(userData);
      mockModel.withArgs(userData).returns(expectedDocInstance);
      expectedDocInstance.save.rejects(duplicateError);

      await expect(repository.create(userData))
        .to.be.rejectedWith("email already exists")
        .and.eventually.satisfy((err: any) => {
          expect(err.name).to.equal("DuplicateError");
          return true;
        });
      expect(mockModel.calledOnceWith(userData)).to.be.true;
      expect(expectedDocInstance.save.calledOnce).to.be.true;
    });

    it("should throw DatabaseError for other save failures", async () => {
      const genericDbError = new Error("Operation failed");

      const expectedDocInstance = createMockUserDocInstance(userData);
      mockModel.withArgs(userData).returns(expectedDocInstance);
      expectedDocInstance.save.rejects(genericDbError);

      await expect(repository.create(userData))
        .to.be.rejectedWith(genericDbError.message)
        .and.eventually.satisfy((err: any) => {
          expect(err.name).to.equal("DatabaseError");
          return true;
        });
      expect(mockModel.calledOnceWith(userData)).to.be.true;
      expect(expectedDocInstance.save.calledOnce).to.be.true;
    });
  });

  describe("update", () => {
    const userId = new Types.ObjectId().toString();
    const updateData = { username: "updatedUser" };
    const updatedUserDoc = { _id: userId, ...updateData } as IUser;

    it("should update a user successfully", async () => {
      mockQuery.exec.resolves(updatedUserDoc);

      const result = await repository.update(userId, updateData);

      expect(
        mockModel.findOneAndUpdate.calledOnceWith(
          { _id: userId },
          { $set: updateData }, // UserRepository's update uses $set
          { new: true }
        )
      ).to.be.true;
      expect(mockQuery.session.called).to.be.false;
      expect(mockQuery.exec.calledOnce).to.be.true;
      expect(result).to.deep.equal(updatedUserDoc);
    });

    it("should use session when updating", async () => {
      mockQuery.exec.resolves(updatedUserDoc);

      await repository.update(userId, updateData, mockSession);

      expect(mockModel.findOneAndUpdate.calledOnce).to.be.true;
      expect(mockQuery.session.calledOnceWith(mockSession)).to.be.true;
      expect(mockQuery.exec.calledOnce).to.be.true;
    });

    it("should return null if user to update is not found", async () => {
      mockQuery.exec.resolves(null);
      const result = await repository.update(userId, updateData);
      expect(result).to.be.null;
    });

    it("should throw DuplicateError on update if it encounters a duplicate key error (e.g., unique username)", async () => {
      const duplicateError: any = new Error("Duplicate key error on update");
      duplicateError.code = 11000;
      duplicateError.keyValue = { username: "existingUser" };
      mockQuery.exec.rejects(duplicateError);

      await expect(repository.update(userId, { username: "existingUser" }))
        .to.be.rejectedWith("username already exists")
        .and.eventually.satisfy((err: any) => {
          expect(err.name).to.equal("DuplicateError");
          return true;
        });
    });

    it("should throw DatabaseError for other update failures", async () => {
      const dbError = new Error("Update failed");
      mockQuery.exec.rejects(dbError);

      await expect(repository.update(userId, updateData))
        .to.be.rejectedWith(dbError.message)
        .and.eventually.satisfy((err: any) => {
          expect(err.name).to.equal("DatabaseError");
          return true;
        });
    });
  });
  describe("update", () => {
    const userId = new Types.ObjectId().toString();
    const updateData = { username: "updatedUser" };
    const updatedUserDoc = { _id: userId, ...updateData } as IUser;

    it("should update a user successfully", async () => {
      mockQuery.exec.resolves(updatedUserDoc);

      const result = await repository.update(userId, updateData);

      expect(
        mockModel.findOneAndUpdate.calledOnceWith(
          { _id: userId },
          { $set: updateData }, // UserRepository's update uses $set
          { new: true }
        )
      ).to.be.true;
      expect(mockQuery.session.called).to.be.false;
      expect(mockQuery.exec.calledOnce).to.be.true;
      expect(result).to.deep.equal(updatedUserDoc);
    });

    it("should use session when updating", async () => {
      mockQuery.exec.resolves(updatedUserDoc);

      await repository.update(userId, updateData, mockSession);

      expect(mockModel.findOneAndUpdate.calledOnce).to.be.true;
      expect(mockQuery.session.calledOnceWith(mockSession)).to.be.true;
      expect(mockQuery.exec.calledOnce).to.be.true;
    });

    it("should return null if user to update is not found", async () => {
      mockQuery.exec.resolves(null);
      const result = await repository.update(userId, updateData);
      expect(result).to.be.null;
    });

    it("should throw DuplicateError on update if it encounters a duplicate key error (e.g., unique username)", async () => {
      const duplicateError: any = new Error("Duplicate key error on update");
      duplicateError.code = 11000;
      duplicateError.keyValue = { username: "existingUser" };
      mockQuery.exec.rejects(duplicateError);

      await expect(repository.update(userId, { username: "existingUser" }))
        .to.be.rejectedWith("username already exists")
        .and.eventually.satisfy((err: any) => {
          expect(err.name).to.equal("DuplicateError");
          return true;
        });
    });

    it("should throw DatabaseError for other update failures", async () => {
      const dbError = new Error("Update failed");
      mockQuery.exec.rejects(dbError);

      await expect(repository.update(userId, updateData))
        .to.be.rejectedWith(dbError.message)
        .and.eventually.satisfy((err: any) => {
          expect(err.name).to.equal("DatabaseError");
          return true;
        });
    });
  });
});
