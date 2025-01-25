import mongoose from "mongoose";
import { IFollow } from "../types";

const followSchema = new mongoose.Schema<IFollow>({
  followerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  followeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now },
  // more fields later
});

const Follow = mongoose.model<IFollow>('Follow', followSchema);
export default Follow;
