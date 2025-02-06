import { ClientSession } from "mongoose";
import { ImageRepository } from "../../repositories/image.repository";
import { UserRepository } from "../../repositories/user.repository";

export interface IUnitOfWork {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  userRepository: UserRepository;
  imageRepository: ImageRepository;
}

// Interface for repositories that will use UnitOfWork
export interface IRepository<T> {
  create(item: Partial<T>, session?: ClientSession): Promise<T>;
  update(id: string, item: Partial<T>, session?: ClientSession): Promise<T | null>;
  delete(id: string, session?: ClientSession): Promise<boolean>;
  findById(id: string, session?: ClientSession): Promise<T | null>;
}