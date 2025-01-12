import { UserRepository } from '../repositories/user.repository';
import { IUser } from '../models/user.model';
import { createError } from '../utils/errors';
import jwt from 'jsonwebtoken';

export class UserService {
  private userRepository: UserRepository;

  private generateToken(user: IUser): string{
    const payload = { id: user._id, email: user.email, username: user.username };
    const secret = process.env.JWT_SECRET;
    const options = {expiresIn: '6h'};
  
    return jwt.sign(payload, secret, options);
  }
  
  constructor() {
    this.userRepository = new UserRepository();
  }

  async registerUser(userData: IUser): Promise<IUser> {
    try {  
      //Checks for uniqueness are handled and enforced by the database
      return await this.userRepository.create(userData);
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async login(userData: IUser): Promise<{user: IUser; token: string}> {
    try {
      const user = await this.userRepository.loginUser(userData.email, userData.password);

      if(!user){
        throw createError('AuthenticationError', 'Invalid email or password');
      }

      const token = this.generateToken(user);
      return { user, token };
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async getUsers(): Promise<IUser[]>{
    return await this.userRepository.getAll();  
  }

  async drop(): Promise<Object>{
    return this.userRepository.deleteAll();
  }

  async update(id: string, userData: Partial<IUser>): Promise<void>{
    try {
      const user = await this.userRepository.update(id, userData);
      if(!user){
        throw createError('ValidationError', 'User not found');
      }
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  
  async deleteUser(id: string): Promise<void> {
    try {
      const result = await this.userRepository.delete(id);
      if(!result){
        throw createError('InternalServerError', 'Something went horribly wrong in repository layer');
      }
    } catch (error) {
      throw createError(error.name, error.message);
    }
  }

  async getUserById(id: string): Promise<IUser | null> {
    try {
      return await this.userRepository.findById(id);

    } catch (error) {
      throw createError(error.name, error.message);

    }
  }


}