import "reflect-metadata";
import { jest, describe, beforeEach, it, expect } from "@jest/globals";
import { UserRepository } from "../../repositories/user.repository";
import { Model, ClientSession } from "mongoose";
import { MockUserModel } from "../__mocks__/mockUserModel";

const mockModelFactory = jest
  .fn()
  .mockImplementation((data) => new MockUserModel(data));

(mockModelFactory as any).findOneAndUpdate = jest.fn();
(mockModelFactory as any).find = jest.fn();
(mockModelFactory as any).countDocuments = jest.fn();
(mockModelFactory as any).findOne = jest.fn();

describe("UserRepository with proper model mocking", () => {
  let repo: UserRepository;
  let session: ClientSession;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new UserRepository(mockModelFactory as unknown as Model<any>);
    session = {} as ClientSession;
  });

  describe("create", () => {
    it("should create and save a new user with session", async () => {
      const userData = { username: "test", email: "a@b.com" };

      const result = await repo.create(userData, session);
      // expect(result.$session).toHaveBeenCalledWith(session);
      console.log(result);

      expect(result).toMatchObject(userData);

      // expect(MockUserModel.prototype.save).toHaveBeenCalled();
    });
  });
});
