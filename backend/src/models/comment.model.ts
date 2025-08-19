import mongoose, { Schema, Document } from "mongoose";

export interface IComment extends Document {
	_id: mongoose.Types.ObjectId;
	content: string;
	imageId: mongoose.Types.ObjectId;
	userId: mongoose.Types.ObjectId;
	createdAt: Date;
	updatedAt: Date;
	isEdited: boolean;
}

const commentSchema = new Schema<IComment>(
	{
		content: {
			type: String,
			required: true,
			trim: true,
			maxlength: 500, // Limit comment length
		},
		imageId: {
			type: Schema.Types.ObjectId,
			ref: "Image",
			required: true,
			index: true, // Index for fast queries by image
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

// Compound index for efficient pagination by image
commentSchema.index({ imageId: 1, createdAt: -1 });

// Index for user's comments
commentSchema.index({ userId: 1, createdAt: -1 });

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
