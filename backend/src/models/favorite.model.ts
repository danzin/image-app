import mongoose, { Schema, Document } from "mongoose";
import { IFavorite } from "types/index";

const favoriteSchema = new Schema<IFavorite>(
	{
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		imageId: {
			type: Schema.Types.ObjectId,
			ref: "Image",
			required: true,
		},
	},
	{ timestamps: true } // Autmatically manage createdAt and updatedAt fields
);

favoriteSchema.index({ userId: 1, imageId: 1 }, { unique: true }); // compound index to ensure a user can only favorite an image once
favoriteSchema.index({ userId: 1, createdAt: -1 }); // index to efficiently query for a user's favorites, sorted by most recent

const Favorite = mongoose.model<IFavorite>("Favorite", favoriteSchema);
export default Favorite;
