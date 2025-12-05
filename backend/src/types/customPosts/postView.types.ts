import mongoose, { Document } from "mongoose";

export interface IPostView extends Document {
	post: mongoose.Types.ObjectId;
	user: mongoose.Types.ObjectId;
	viewedAt: Date;
}
