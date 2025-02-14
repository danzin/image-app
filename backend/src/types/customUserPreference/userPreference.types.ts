import mongoose, { Document } from "mongoose";

export interface IUserPreference extends Document {
  userId: mongoose.Types.ObjectId;
  tag: string;
  score: number;
  lastInteraction: Date;
}