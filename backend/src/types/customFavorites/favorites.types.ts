import mongoose, { Document } from "mongoose";

export interface IFavorite extends Document<mongoose.Types.ObjectId, {}, IFavorite> {
	_id: mongoose.Types.ObjectId;
	userId: mongoose.Types.ObjectId;
	postId: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}
