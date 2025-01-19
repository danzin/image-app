import { Document } from "mongoose";

export interface IImage extends Document {
  userId: string;
  url: string;
  publicId: string;
  createdAt: Date;
  tags: string[]
}

export interface IUser extends Document{
  username: string,
  email: string,
  password: string,
  createdAt: Date,
  updatedAt: Date,
  isAdmin: boolean,
  images: string[],
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface BaseRepository<T> {
  create(item: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, item: Partial<T>): Promise<T | null>;
  delete(id: string): Promise<|boolean>;
}

