import mongoose, { Schema } from "mongoose";
import { ICommentLike } from "../types";

const commentLikeSchema = new Schema<ICommentLike>(
	{
		commentId: { type: Schema.Types.ObjectId, ref: "Comment", required: true, index: true },
		userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
	},
	{ timestamps: true }
);

commentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true });

export const CommentLike = mongoose.model<ICommentLike>("CommentLike", commentLikeSchema);
