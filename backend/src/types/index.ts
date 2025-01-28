import mongoose, { Document, Mongoose } from "mongoose";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";

export interface IImage extends Document {
  url: string;
  publicId: string;
  user: {
    id: mongoose.Schema.Types.ObjectId,
    username: string;
  }
  createdAt: Date;
  tags: { tag: string }[]; 
}

export interface ITag extends Document {
  tag: string;
  count?: number; // Optional because default value
  modifiedAt?: Date; // Optional becasue default value
}

export interface IUser extends Document{
  username: string,
  email: string,
  avatar: string,
  cover: string,
  password: string,
  createdAt: Date,
  updatedAt: Date,
  isAdmin: boolean,
  images: string[],
  followers: string[],
  following: string[]
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface BaseRepository<T> {
  create(item: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  update(id: string, item: Partial<T>): Promise<T | null>;
  delete(id: string): Promise< T | boolean | void>;
}


export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CloudinaryResponse {
  result: 'ok' | 'error';
  message?: string;
}

export interface ILike {
  userId: mongoose.Types.ObjectId;
  imageId:  mongoose.Types.ObjectId;
  timestamp: Date;
}

export interface IFollow {
  followerId: mongoose.Types.ObjectId;
  followeeId: mongoose.Types.ObjectId;
  timestamp: Date;
}

export interface IUserAction extends Document {
  userId: mongoose.Types.ObjectId;
  actionType: string; // like, follow, upload etc
  targetId: mongoose.Types.ObjectId; // imageId or UserId etc
  timestamp: Date;
}

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;       
  actionType: string;   
  actorId: mongoose.Types.ObjectId;     
  targetId?: mongoose.Types.ObjectId;    
  isRead: boolean;
  timestamp: Date;
}

export interface IUnitOfWork {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  userRepository: UserRepository;
  imageRepository: ImageRepository;
}