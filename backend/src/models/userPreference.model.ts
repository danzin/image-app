import { IUserPreference } from "@/types";
import mongoose, { Schema } from "mongoose";

const userPreferenceSchema = new Schema(
	{
		userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
		tag: { type: String, required: true },
		score: { type: Number, default: 0 },
		lastInteraction: { type: Date, default: Date.now },
	},
	{
		timestamps: true,
	}
);

// Adding compount index for more efficient queries
userPreferenceSchema.index({ userId: 1, tag: 1 }, { unique: true });
userPreferenceSchema.index({ userId: 1, score: -1 });
userPreferenceSchema.index({ tag: 1, score: -1 });

export const UserPreference = mongoose.model<IUserPreference>("UserPreference", userPreferenceSchema);
