import mongoose from "mongoose";
import { ILike } from "../types";

const likeSchema = new mongoose.Schema<ILike>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true  },
  imageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Image', required: true  },
  timestamp: { type: Date, default: Date.now },
  // more fields later if necessary 
});

const Like = mongoose.model<ILike>('Like', likeSchema);
export default Like;
