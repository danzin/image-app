import mongoose, { Document } from "mongoose";

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