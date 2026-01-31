import mongoose, { Schema } from "mongoose";
import { IPostView } from "@/types";

const postViewSchema = new Schema<IPostView>(
	{
		post: {
			type: Schema.Types.ObjectId,
			ref: "Post",
			required: true,
			index: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true, // only track authenticated user views
			index: true,
		},
		viewedAt: {
			type: Date,
			default: Date.now,
			required: true,
		},
	},
	{ timestamps: false }
);

// compound index to ensure one view per user per post
postViewSchema.index({ post: 1, user: 1 }, { unique: true });

const PostView = mongoose.model<IPostView>("PostView", postViewSchema);
export default PostView;
