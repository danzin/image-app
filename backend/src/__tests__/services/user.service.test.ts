import { UserService } from '../../services/user.service';
import { UserRepository } from '../../repositories/user.repository';
import { IUser } from '../../types';
import { createError } from '../../utils/errors';
import jwt from 'jsonwebtoken';

jest.mock('../../repositories/user.repository');
jest.mock('jsonwebtoken');

describe('UserService', () => {
  let userService: UserService;
  let userRepository: jest.Mocked<UserRepository>;
  let mockUser: IUser;

  beforeEach(() => {
    userRepository = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService();
    userService['userRepository'] = userRepository; //Inject the mocked repository
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
    } as unknown as IUser;
  });

  describe('registerUser', () => {
    it('should register a user successfully', async () => {
      userRepository.create.mockResolvedValueOnce(mockUser);

      const result = await userService.registerUser(mockUser);

      expect(result).toEqual(mockUser);
      expect(userRepository.create).toHaveBeenCalledWith(mockUser);
    });

    it('should throw an error if registration fails', async () => {
      const error = createError('InternalServerError', 'Registration failed');
      userRepository.create.mockRejectedValueOnce(error);

      await expect(userService.registerUser({} as IUser)).rejects.toThrow('Registration failed');
    });
  });

  describe('login', () => {
    it('should login a user successfully and return a token', async () => {
      

      const mockToken = 'mock-token';
      userRepository.loginUser.mockResolvedValueOnce(mockUser);
      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      const result = await userService.login(mockUser);

      expect(result).toEqual({ user: mockUser, token: mockToken });
      expect(userRepository.loginUser).toHaveBeenCalledWith(mockUser.email, mockUser.password);
      expect(jwt.sign).toHaveBeenCalledWith(
        { id: mockUser._id, email: mockUser.email, username: mockUser.username },
        process.env.JWT_SECRET,
        { expiresIn: '6h' }
      );
    });

    it('should throw an error if login fails', async () => {
      userRepository.loginUser.mockResolvedValueOnce(null);

      await expect(userService.login({ email: 'test-email', password: 'test-password' } as IUser))
        .rejects
        .toThrow('Invalid email or password');
    });
  });

  describe('update', () => {
    it('should call userRepository.update with userId and user details', async () => {
      
      const updatedUser: IUser = {
        ...mockUser,
        username: 'updated-uname',
      } as IUser;

      userRepository.update.mockResolvedValueOnce(updatedUser);

      await expect(userService.update(mockUser._id as string, { username: 'updated-uname' })).resolves.toBeUndefined();
      expect(userRepository.update).toHaveBeenCalledWith(mockUser._id, { username: 'updated-uname' });
    });

    it('should throw error if user is not found', async () => {
      const error = createError('ValidationError', 'User not found');

      await expect(userService.update('non-existent-Id', {password: 'test'})).rejects.toThrow(error)
    });

  });

  describe('delete', () => {
    it('should call userRepository.delete with userId', async () => {
 
      userRepository.delete.mockResolvedValueOnce(true);

      await expect(userService.deleteUser('test-id')).resolves.toBeUndefined();
      expect(userRepository.delete).toHaveBeenCalledWith('test-id')

    });
    
    it('should throw an error if deletion fails', async () => {
      const error = createError('InternalServerError', 'Deletion failed');
      userRepository.delete.mockRejectedValueOnce(error);

      await expect(userService.deleteUser('test-id')).rejects.toThrow('Deletion failed');
    });
  });

  describe('getUserById', () => {
    it('should return user object by id', async () => {
      userRepository.findById.mockResolvedValueOnce(mockUser);
      const result = await userService.getUserById(mockUser._id as string);
      
      expect(result).toEqual(mockUser);
      expect(userRepository.findById).toHaveBeenCalledWith(mockUser._id);

    });

    it('should throw error when user is not found', async () => {
      const error = createError('PathError', 'User not found')
      
      userRepository.findById.mockResolvedValueOnce(null);
      await expect(userService.getUserById(mockUser._id as string)).rejects.toThrow(error)
    });
  });

});