import mongoose, { Schema } from "mongoose";
import { IFavorite } from "@/types";

const favoriteSchema = new Schema<IFavorite>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		postId: {
			type: Schema.Types.ObjectId,
			ref: "Post",
			required: true,
		},
	},
	{ timestamps: true }, // Autmatically manage createdAt and updatedAt fields
);

favoriteSchema.index({ userId: 1, postId: 1 }, { unique: true }); // compound index to ensure a user can only favorite a post once
favoriteSchema.index({ userId: 1, createdAt: -1 }); // compound index to efficiently query for a user's favorites, sorted by most recent

const Favorite = mongoose.model<IFavorite>("Favorite", favoriteSchema);
export default Favorite;
