import { UserService } from '../../services/user.service';
import { UserRepository } from '../../repositories/user.repository';
import { IUser } from '../../models/user.model';
import { createError } from '../../utils/errors';
import jwt from 'jsonwebtoken';

jest.mock('../../repositories/user.repository');
jest.mock('jsonwebtoken');

describe('UserService', () => {
  let userService: UserService;
  let userRepository: jest.Mocked<UserRepository>;

  beforeEach(() => {
    userRepository = new UserRepository() as jest.Mocked<UserRepository>;
    userService = new UserService();
    userService['userRepository'] = userRepository; //Inject the mocked repository
  });

  describe('registerUser', () => {
    it('should register a user successfully', async () => {
      const mockUser: IUser = {
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
      const mockUser: IUser = {
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

      await expect(userService.login({ email: 'test-email', password: 'test-password' } as IUser)).rejects.toThrow(
        'Invalid email or password'
      );
    });


  });

  


});