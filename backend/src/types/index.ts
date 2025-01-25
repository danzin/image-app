import mongoose, { Document } from "mongoose";

export interface IImage extends Document {
  user: {
    _id: mongoose.Schema.Types.ObjectId,
    username: string;
  }
  url: string;
  publicId: string;
  createdAt: Date;
  tags: { tag: string }[]; //populated tags
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
  userId: mongoose.Schema.Types.ObjectId;
  imageId:  mongoose.Schema.Types.ObjectId;
  timestamp: Date;
}

export interface IFollow {
  followerId: mongoose.Schema.Types.ObjectId;
  followeeId: mongoose.Schema.Types.ObjectId;
  timestamp: Date;
}

export interface IUserAction extends Document {
  userId: string;
  actionType: string; // like, follow, upload etc
  targetId: string; // imageId or UserId etc
  timestamp: Date;
}
