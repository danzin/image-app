import mongoose, { Schema } from "mongoose";
import { IFollow } from "../types";

const followSchema = new Schema<IFollow>({
	followerId: { type: Schema.Types.ObjectId, ref: "User" },
	followeeId: { type: Schema.Types.ObjectId, ref: "User" },
	timestamp: { type: Date, default: Date.now },
	// more fields later
});

const Follow = mongoose.model<IFollow>("Follow", followSchema);
export default Follow;
