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
			maxlength: 300,
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
		likes: {
			type: [
				{
					type: Schema.Types.ObjectId,
					ref: "User",
				},
			],
			default: [],
		},

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
		viewsCount: {
			type: Number,
			default: 0,
			required: true,
			index: true,
		},
	},
	{ timestamps: true }
);

postSchema.index({ user: 1, createdAt: -1 }); // profile feed qyeries
postSchema.index({ createdAt: -1 }); // newest posts
postSchema.index({ tags: 1, createdAt: -1 }); // tag discovery
postSchema.index({ slug: 1 }, { unique: true, sparse: true }); // fast lookup by slug
postSchema.index({ likesCount: -1 }); // popularity queries
postSchema.index({ commentsCount: -1, likesCount: -1 }); // engagement ranking
postSchema.index(
	{ createdAt: -1, likesCount: -1 },
	{
		partialFilterExpression: { likesCount: { $gte: 1 } }, // trending mix: recent and likes
	}
);
postSchema.index({ likes: 1 }); // fast lookup for user like membership
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
