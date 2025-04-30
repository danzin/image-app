import mongoose, { Schema, model, CallbackError } from "mongoose";
import validator from "validator";
import bcryptjs from "bcryptjs";
import { IUser } from "../types";

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
    },
    avatar: {
      type: String,
      required: false,
      default:
        "https://res.cloudinary.com/dfyqaqnj7/image/upload/v1737562142/defaultAvatar_evsmmj.jpg",
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
    images: [
      {
        type: String,
        ref: "Image",
      },
    ],
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
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
// This be redundant now
userSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  // Update doesn't work on aggregation pipelines
  //check if it's not an array aka aggr pipeline
  if (update && typeof update === "object" && !Array.isArray(update)) {
    //check if password is being updated
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

//Alternative handling of cascading deletes, currently using transaction inside userRepository instead
// userSchema.pre('deleteOne', async function (next) {
//   const userId = this.getQuery()["_id"];
//   await Image.deleteMany({ userId });
//   next();
// });

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcryptjs.compare(candidatePassword, this.password);
};
userSchema.index({ username: "text" });

const User = model<IUser>("User", userSchema);
export default User;
