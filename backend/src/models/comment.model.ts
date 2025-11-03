import mongoose, { Schema } from "mongoose";
import { IComment } from "types/index";
const commentSchema = new Schema<IComment>(
	{
		content: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500, // Limit comment length
		},
		postId: {
			type: Schema.Types.ObjectId,
			ref: "Post",
			required: true,
			index: true, // Index for fast queries by post
		},
		userId: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true, // Index for fast queries by user
		},
		isEdited: {
			type: Boolean,
			default: false,
		},
	},
	{
		timestamps: true, // Automatically adds createdAt and updatedAt
	}
);

// Compound index for efficient pagination by post
commentSchema.index({ postId: 1, createdAt: -1 });

// Index for user's comments
commentSchema.index({ userId: 1, createdAt: -1 });

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
