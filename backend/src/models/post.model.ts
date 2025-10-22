import mongoose, { Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { IPost } from "../types";

const postSchema = new Schema<IPost>(
	{
		publicId: {
			type: String,
			default: uuidv4,
			unique: true,
			immutable: true,
		},
		user: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		body: {
			type: String,
			trim: true,
			maxlength: 250,
		},
		slug: {
			type: String,
			trim: true,
			index: true,
		},
		image: {
			type: Schema.Types.ObjectId,
			ref: "Image",
			default: null,
		},
		tags: [
			{
				type: Schema.Types.ObjectId,
				ref: "Tag",
			},
		],

		likesCount: {
			type: Number,
			default: 0,
			required: true,
		},
		commentsCount: {
			type: Number,
			default: 0,
			required: true,
		},
	},
	{ timestamps: true }
);

// index for profile feed queries
postSchema.index({ user: 1, createdAt: -1 });
// index for newest posts
postSchema.index({ createdAt: -1 });
// index for tag discovery
postSchema.index({ tags: 1, createdAt: -1 });
// index for trending posts
postSchema.index({ likesCount: -1, createdAt: -1 });

postSchema.set("toJSON", {
	transform: (_doc, raw) => {
		const ret: any = raw;
		if (ret._id) {
			ret.id = ret._id.toString();
			delete ret._id;
		}

		if (ret.user && typeof ret.user === "object" && ret.user._id) {
			ret.user = {
				id: ret.user._id.toString(),
				username: ret.user.username,
				publicId: ret.user.publicId,
			};
		}

		if (Array.isArray(ret.tags)) {
			ret.tags = ret.tags.map((tag: any) => {
				if (tag && typeof tag === "object" && tag._id) {
					return { id: tag._id.toString(), tag: tag.tag };
				}
				return tag;
			});
		}

		if (ret.__v !== undefined) {
			delete ret.__v;
		}
		return ret;
	},
});

const Post = mongoose.model<IPost>("Post", postSchema);
export default Post;
