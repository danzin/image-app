import mongoose, { Document } from "mongoose";

export interface IPost extends Document {
	publicId: string;
	user: mongoose.Types.ObjectId;
	body?: string;
	slug?: string;
	image?: mongoose.Types.ObjectId | null;
	tags: mongoose.Types.ObjectId[];
	likesCount: number;
	commentsCount: number;
	viewsCount: number;
	createdAt: Date;
	updatedAt: Date;
}
