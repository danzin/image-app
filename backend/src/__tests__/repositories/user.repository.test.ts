import { UserRepository } from "../../repositories/user.repository";
import User from "../../models/user.model";
import { IUser } from "../../types";
import { createError } from "../../utils/errors";
import mongoose from 'mongoose';


jest.mock('../../models/user.model');
jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');
  return {
    ...actualMongoose,
    startSession: jest.fn(),
  };
});

describe('UserRepository', () => {
  let repository: UserRepository;
  let session: any;


  beforeEach(() => {
    jest.clearAllMocks();
    repository = new UserRepository;
    session = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
    };
    (mongoose.startSession as jest.Mock).mockResolvedValue(session);
  })

  describe('create', () => {
    it('should create a user successfully', async () => {
      //mock user
      const mockUser: IUser = {
        _id: 'test-id',
        username: 'test-uname',
        email: 'test-email',
        password: 'test-password',
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
        isAdmin: false
      } as IUser;

      //mock user.create method to resolve with mockUser
      (User.create as jest.Mock).mockResolvedValueOnce(mockUser);
      const result = await repository.create(mockUser);

      expect(result).toEqual(mockUser);
      expect(User.create).toHaveBeenCalledWith(mockUser);
    });

    it('should throw 11000 error when creation fails with duplicate user', async () => {
      const error = new Error('Duplicate key error');
      const mockUser: IUser = {
        _id: 'test-id',
        username: 'test-uname',
        email: 'test-email',
        password: 'test-password',
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
        isAdmin: false
      } as IUser;
      (error as any).code = 11000;
      (error as any).keyValue = {"email": mockUser.email};
      (User.create as jest.Mock).mockRejectedValueOnce(error);
     
      await expect(repository.create(mockUser)).rejects.toThrow(`email '${mockUser.email}' is already taken`);
    });


  });

  describe('loginUser', () => {
    it('should return null if user is not found', async () => {
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const result = await repository.loginUser('test-email', 'test-password');
      expect(result).toBeNull();
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test-email' });
    });

    it('should return null if password is invalid', async () => {
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await repository.loginUser('test-email', 'test-password');
      expect(result).toBeNull();
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test-email' });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('test-password');
    });

    it('should return user object without password if login is successful', async () => {
      const mockUser = {
        comparePassword: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: 'test-id',
          username: 'test-uname',
          email: 'test-email',
          createdAt: new Date(),
          updatedAt: new Date(),
          images: [],
          isAdmin: false,
        }),
      };

      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const result = await repository.loginUser('test-email', 'test-password');
      expect(result).toEqual({
        _id: 'test-id',
        username: 'test-uname',
        email: 'test-email',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        images: [],
        isAdmin: false,
      });
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test-email' });
      expect(mockUser.comparePassword).toHaveBeenCalledWith('test-password');
      expect(mockUser.toObject).toHaveBeenCalled();
    });

    it('should throw an internal server error if an exception occurs', async () => {
      const error = createError('InternalServerError','Internal Server Error'  );
      (User.findOne as jest.Mock).mockReturnValue({
        select: jest.fn().mockRejectedValue(error),
      });

      await expect(repository.loginUser('test-email', 'test-password')).rejects.toThrow('Internal Server Error');
    });
  });

  describe('update', () => {
    it('should update user details', async () => {
      const mockUser: IUser = {
        _id: 'test-id',
        username: 'test-uname',
        email: 'test-email',
        password: 'test-password',
        createdAt: new Date(),
        updatedAt: new Date(),
        images: [],
        isAdmin: false
      } as IUser;
  
      const updatedUser: IUser = {
        ...mockUser, username: 'updated-username',
      } as IUser;
  
      (User.findByIdAndUpdate as jest.Mock).mockResolvedValueOnce(updatedUser);
      const result = await repository.update(mockUser._id as string, {username: 'updated-username'});
      expect(result).toEqual(updatedUser);
      
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(mockUser._id, { username: 'updated-username' }, { new: true });
  
    });
    

  });

  describe('delete', () => {
    it('should delete a user and their images successfully', async () => {
      const mockUserId = 'test-id';
      const mockDeleteCount = { deletedCount: 1 };

      repository['imageRepository'] = {
        deleteMany: jest.fn().mockResolvedValue(true),
      } as any;

      (User.deleteOne as jest.Mock).mockResolvedValueOnce(mockDeleteCount);
      const result = await repository.delete(mockUserId);

      expect(result).toBe(true);
      expect(mongoose.startSession).toHaveBeenCalled();
      expect(session.startTransaction).toHaveBeenCalled();
      expect(repository['imageRepository'].deleteMany).toHaveBeenCalledWith(mockUserId);
      expect(User.deleteOne).toHaveBeenCalledWith({ _id: mockUserId });
      expect(session.commitTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();

    });

    it('should abort transaction and throw an error if deletion fails', async () => {
      const mockUserId = 'test-id';
      const error = new Error('Deletion failed');

      repository['imageRepository'] = {
        deleteMany: jest.fn().mockResolvedValue(true),
      } as any;

      (User.deleteOne as jest.Mock).mockRejectedValueOnce(error);

      await expect(repository.delete(mockUserId)).rejects.toThrow('Deletion failed');
      expect(mongoose.startSession).toHaveBeenCalled();
      expect(session.startTransaction).toHaveBeenCalled();
      expect(repository['imageRepository'].deleteMany).toHaveBeenCalledWith(mockUserId);
      expect(User.deleteOne).toHaveBeenCalledWith({ _id: mockUserId });
      expect(session.abortTransaction).toHaveBeenCalled();
      expect(session.endSession).toHaveBeenCalled();
    });
  
  });

  

})

