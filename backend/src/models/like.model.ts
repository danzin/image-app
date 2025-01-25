import mongoose from "mongoose";
import { ILike } from "../types";

const likeSchema = new mongoose.Schema<ILike>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Image' },
  timestamp: { type: Date, default: Date.now },
  // more fields later
});

const Like = mongoose.model<ILike>('Like', likeSchema);
export default Like;
