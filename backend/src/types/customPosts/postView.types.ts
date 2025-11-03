import mongoose, { Document } from "mongoose";

export interface IPostView extends Document {
	post: mongoose.Types.ObjectId;
	user: mongoose.Types.ObjectId; // only track authenticated users
	viewedAt: Date;
}
