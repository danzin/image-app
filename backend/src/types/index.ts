import mongoose, { ClientSession, Document, Mongoose } from "mongoose";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";
import { createError } from "../utils/errors";

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

export interface IImage extends Document {
  url: string;
  publicId: string;
  user: {
    id: mongoose.Schema.Types.ObjectId,
    username: string;
  }
  createdAt: Date;
  tags: { tag: string }[];
  likes: number;
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

export interface ILike extends Document {
  userId: mongoose.Types.ObjectId;
  imageId:  mongoose.Types.ObjectId;
  timestamp: Date;
}

export interface IFollow extends Document {
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

export interface CloudinaryResult {
  result: 'ok' | 'error';
  message?: string;
}

export interface CloudinaryDeleteResponse {
  deleted: Record<string, string>;
  deleted_counts: Record<string, { original: number; derived: number }>;
  partial: boolean;
  rate_limit_allowed: number;
  rate_limit_reset_at: string;
  rate_limit_remaining: number;
}