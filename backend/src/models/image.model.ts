import mongoose, { Schema } from "mongoose";
import { IImage, ITag } from "../types";
import User from "./user.model";
import { v4 as uuidv4 } from "uuid";

const imageSchema = new Schema<IImage>({
	url: { type: String, required: true },
	publicId: {
		type: String,
		required: true,
		unique: true, // Defult index
		default: uuidv4(),
		immutable: true,
	},
	slug: {
		type: String,
		required: true,
		index: true,
	},
	originalName: {
		type: String,
		required: true,
	},
	user: { type: Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User schema
	createdAt: { type: Date, default: Date.now },
	tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }], // Reference to Tag schema
	likes: { type: Number, default: 0, required: true },
	commentsCount: { type: Number, default: 0, required: true }, // Track comment count for performance
});

const tagSchema = new Schema<ITag>({
	tag: { type: String, required: true, unique: true },
	count: { type: Number, default: 0 },
	modifiedAt: { type: Date, default: Date.now },
});

// Pre-save middleware to generate slug
imageSchema.pre("save", function (next) {
	if (this.isNew && this.originalName) {
		this.slug =
			this.originalName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "") +
			"-" +
			Date.now();
	}
	next();
});

//Update tags every time an image is uploaded
imageSchema.post("save", async function (doc, next) {
	const session = doc.$session(); // Get session from the document
	try {
		if (doc.tags && doc.tags.length > 0) {
			for (let tagId of doc.tags) {
				// Fetch the actual tag string from the Tag collection
				const tagDoc = await Tag.findById(tagId).session(session);
				if (tagDoc) {
					console.log("Updating tag:", tagDoc.tag);
					await Tag.findOneAndUpdate(
						{ tag: tagDoc.tag }, // Use the tag string, not the ObjectId
						{ $inc: { count: 1 }, $set: { modifiedAt: new Date() } },
						{ upsert: true, new: true, session } // Pass the session
					);
				}
			}
		}
		next();
	} catch (error) {
		next(error as Error);
	}
});

/**This mongoose middleware allows for much easier work with data
 * on the frontend. Everything broke when I directly referenced User and Tag inside the
 * Image document because react-query was supposed to receive string as id, now it receives
 * mongoose object id.
 *
 * This function strips the `_id` and converts it to `id` of type string.
 * It transforms the nested user object that now resides inside images.
 * It removes reduntant, repetitive fields from the object(username, id)
 * and transforms nested arrays tags create.
 * Also removes __v
 *
 * The `toJSON` mongoose middleware triggers on 3 occasions:
 *   -when calling .toJSON() on a document. for example:
 *     const image = await ImageModel.findById(id);
 *     const jsonImage = image.toJSON();
 *
 *   -when sending data in a response:
 *      const image = await ImageModel.findById(id);
 *      res.json(image);
 *     - this also triggers when sending arrays as responses. if res.json(data[]),
 *        mongoose will iterate through each document and transform it
 *   -when using .lean()
 *
 */
imageSchema.set("toJSON", {
	transform: (_doc, ret) => {
		// Convert _id fields to id
		if (ret._id) {
			ret.id = ret._id.toString(); // Rename _id to id
			delete ret._id; // Delete the original _id
		}

		// Remove redundant fields on the top level
		delete (ret as any).username; // Remove username if it exists

		// Transform nested arrays like `tags`
		if (Array.isArray(ret.tags)) {
			ret.tags = ret.tags.map((tag) => {
				if ((tag as any)._id) {
					return {
						id: (tag as any)._id.toString(),
						tag: tag.tag,
					};
				}
				return tag;
			});
		}

		// Remove __v
		delete (ret as any).__v;
		return ret;
	},
});

/**Update tags when images are deleted.
 * `remove` is deprecated so I'm using `findOneAndDelete` as trigger
 * Now also respects the session
 */
imageSchema.pre("findOneAndDelete", async function (next) {
	// Get the session from the query options if it exists
	// if it doesn't exist, it's undefined, and passing undefined as a session later on
	//just means there's no session and execution continues without session
	const session = this.getOptions().session;
	try {
		const doc = await this.model.findOne(this.getQuery()).session(session || null);
		if (doc && doc.tags && doc.tags.length > 0) {
			console.log(`running in doc of docs loop \r\n doc: ${doc}`);

			for (let tag of doc.tags) {
				console.log(`running in tag of doc.tags loop \r\n tag: ${tag} \r\n tags: ${doc.tags}`);
				await Tag.findOneAndUpdate({ _id: tag }, { $inc: { count: -1 } }, { new: true, session });

				const updatedTag = await Tag.findOne({ _id: tag }).session(session || null);
				if (updatedTag && updatedTag.count !== undefined && updatedTag.count <= 0) {
					await Tag.deleteOne({ _id: tag }).session(session || null);
				}
			}
		}

		if (doc.user._id) {
			console.log(`deleting image ${doc._id} from  user  id ${doc.user._id}`);
			await User.findByIdAndUpdate(doc.user._id, { $pull: { images: doc.url } }, { new: true, session });
		}
		next();
	} catch (error) {
		next(error as Error);
	}
});

//Remove or decrement tags when deleting many images
//Respect the session
imageSchema.pre("deleteMany", async function (next) {
	const session = this.getOptions().session; // Get the session from the query options
	try {
		const docs = await this.model.find(this.getQuery()).session(session || null); // Pass the session
		for (const doc of docs) {
			if (doc.tags && doc.tags.length > 0) {
				for (let tagId of doc.tags) {
					console.log(`tagId inside deleteMany mongoosemiddleware: ${tagId}`);
					const updatedTag = await Tag.findOneAndUpdate(
						{ _id: tagId },
						{ $inc: { count: -1 } },
						{ new: true, session }
					);

					if (updatedTag && updatedTag.count !== undefined && updatedTag.count <= 0) {
						await Tag.deleteOne({ _id: tagId }).session(session || null);
					}
				}
			}
		}
		next();
	} catch (error) {
		next(error as Error);
	}
});

imageSchema.index({ user: 1 });
imageSchema.index({ tags: 1 }); // index for findByTags with $in operator
imageSchema.index({ user: 1, createdAt: -1 }); // compound index for querying images by user and sorting by most recent
imageSchema.index({ createdAt: -1, likes: -1 }); // index for the trending feed

imageSchema.index(
	{ createdAt: -1, likes: -1 },
	{
		partialFilterExpression: { likes: { $gte: 1 } },
	}
); // compound index for trending feed (only images with at least 1 like)

imageSchema.index({ tags: "text", user: "text" });

tagSchema.index({ tag: "text" });
tagSchema.index({ count: -1 });
tagSchema.index({ modifiedAt: -1 });

console.log("Defining Image model");
const Image = mongoose.model<IImage>("Image", imageSchema);
export const Tag = mongoose.model("Tag", tagSchema);
export default Image;
