import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { ICommunity } from "@/types";

const communitySchema = new Schema<ICommunity>(
	{
		publicId: {
			type: String,
			unique: true,
			immutable: true,
			default: uuidv4,
			index: true,
		},
		name: { type: String, required: true, trim: true },
		slug: { type: String, required: true, unique: true, index: true },
		description: { type: String, default: "" },
		avatar: { type: String, default: "" },
		coverPhoto: { type: String, default: "" },
		creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
		stats: {
			memberCount: { type: Number, default: 1 },
			postCount: { type: Number, default: 0 },
		},
	},
	{
		timestamps: true,
		toJSON: {
			transform: function (doc, ret) {
				ret.id = ret._id.toString();
				delete (ret as any)._id;
				delete (ret as any).__v;
				return ret;
			},
		},
	},
);

communitySchema.index({ name: "text", description: "text" });

export const Community = mongoose.model<ICommunity>("Community", communitySchema);
