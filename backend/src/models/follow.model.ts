import mongoose, { Schema } from "mongoose";
import { IFollow } from "../types";

const followSchema = new Schema<IFollow>({
	followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
	followeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
	timestamp: { type: Date, default: Date.now },
	// more fields later
});

followSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
followSchema.index({ followerId: 1 });
followSchema.index({ followeeId: 1 });
// Compound index for fan-out on write: query by followeeId, project followerId
followSchema.index({ followeeId: 1, followerId: 1 });

const Follow = mongoose.model<IFollow>("Follow", followSchema);
export default Follow;
