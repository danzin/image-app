import { Document } from "mongoose";

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