import mongoose, {  Document } from "mongoose";

export interface IFollow extends Document {
  followerId: mongoose.Types.ObjectId;
  followeeId: mongoose.Types.ObjectId;
  timestamp: Date;
}