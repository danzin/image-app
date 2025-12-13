import { Document, Types } from "mongoose";

export interface ICommentLike extends Document {
	commentId: Types.ObjectId;
	userId: Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
}

export interface CommentLikeResult {
	commentId: string;
	isLiked: boolean;
	likesCount: number;
}
