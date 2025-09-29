import mongoose, { Schema } from "mongoose";
import { ILike } from "../types";

const likeSchema = new Schema<ILike>({
	userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
	imageId: { type: Schema.Types.ObjectId, ref: "Image", required: true },
	timestamp: { type: Date, default: Date.now },
	// more fields later if necessary
});

const Like = mongoose.model<ILike>("Like", likeSchema);
export default Like;
