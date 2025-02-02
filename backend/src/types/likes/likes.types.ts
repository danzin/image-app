import mongoose, { Document } from "mongoose";


export interface ILike extends Document {
  userId: mongoose.Types.ObjectId;
  imageId:  mongoose.Types.ObjectId;
  timestamp: Date;
}