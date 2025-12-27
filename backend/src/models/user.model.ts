import { Schema, model, CallbackError } from "mongoose";
import validator from "validator";
import bcryptjs from "bcryptjs";
import { IPost, IUser } from "../types";
import { v4 as uuidv4 } from "uuid";

const userSchema = new Schema<IUser>(
	{
		publicId: {
			type: String,
			unique: true,
			immutable: true,
			default: uuidv4,
			index: true, // explicit index for frequent publicId queries (follows, feeds, lookups)
		},
		username: {
			type: String,
			required: [true, "Username is required"],
			unique: true,
		},
		avatar: {
			type: String,
			required: false,
			default: "https://res.cloudinary.com/dfyqaqnj7/image/upload/v1737562142/defaultAvatar_evsmmj.jpg",
		},
		cover: {
			type: String,
			required: false,
			default: "",
		},
		email: {
			type: String,
			required: [true, "Email is required"],
			unique: true,
			validate: [validator.isEmail, "Please provide a valid email"],
		},
		password: {
			type: String,
			required: [true, "Password is required"],
			select: false,
		},
		bio: {
			type: String,
			required: false,
			default: "",
		},
		createdAt: {
			type: Date,
			default: Date.now,
		},
		updatedAt: {
			type: Date,
			default: Date.now,
		},
		isAdmin: {
			type: Boolean,
			default: false,
			required: true,
		},
		isBanned: {
			type: Boolean,
			default: false,
			required: true,
		},
		bannedAt: {
			type: Date,
			required: false,
		},
		bannedReason: {
			type: String,
			required: false,
		},
		bannedBy: {
			type: Schema.Types.ObjectId,
			ref: "User",
			required: false,
		},
		followerCount: {
			type: Number,
			default: 0,
			required: true,
		},
		followingCount: {
			type: Number,
			default: 0,
			required: true,
		},
		postCount: {
			type: Number,
			default: 0,
			required: true,
		},
		resetToken: { type: String, select: false },
		resetTokenExpires: { type: Date, select: false },
	},
	{
		timestamps: true,
	}
);

// Hash pasword when a new user is registered
userSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();

	try {
		const salt = await bcryptjs.genSalt(10);
		this.password = await bcryptjs.hash(this.password, salt);
		next();
	} catch (error) {
		next(error as CallbackError);
	}
});

// Hash password when user changes it.
// This might be redundant now
userSchema.pre("findOneAndUpdate", async function (next) {
	const update = this.getUpdate();

	// Update doesn't work on aggregation pipelines
	//check if it's not an array aka aggr pipeline
	if (update && typeof update === "object" && !Array.isArray(update)) {
		const password = update.password || update.$set?.password;
		if (password) {
			try {
				const salt = await bcryptjs.genSalt(10);
				const hashedPassword = await bcryptjs.hash(password, salt);

				if (update.password) {
					update.password = hashedPassword;
				} else if (update.$set && update.$set.password) {
					update.$set.password = hashedPassword;
				} else {
					//If $set doesn't exist then create it and set the password
					update.$set = { ...update.$set, password: hashedPassword };
				}

				this.setUpdate(update);
				next();
			} catch (error) {
				next(error as CallbackError);
			}
			//do nothing if user isn't updating password
		} else {
			next();
		}
		//skip if it's an aggregation pipeline
	} else {
		next();
	}
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
	return bcryptjs.compare(candidatePassword, this.password);
};

userSchema.methods.canViewPost = function (post: IPost | { canBeViewedBy?: (user: IUser) => boolean }): boolean {
	if (!post) {
		return false;
	}

	if (this.isBanned) {
		return false;
	}

	if (typeof (post as any).canBeViewedBy === "function") {
		return (post as any).canBeViewedBy(this);
	}

	return true;
};

// Transform the user object when serialized to JSON
userSchema.set("toJSON", {
	transform: (_doc, ret) => {
		// Convert _id to id
		if (ret._id) {
			ret.id = ret._id.toString();
			delete ret._id;
		}

		// Remove fields using type assertion to handle TypeScript errors
		delete (ret as any).__v;
		delete (ret as any).password;
		delete (ret as any).email; // Remove email from public responses unless specifically needed

		return ret;
	},
});

const User = model<IUser>("User", userSchema);
export default User;
