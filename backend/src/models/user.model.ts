import {Schema, model, Document, CallbackError} from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import { IUser } from '../types';

const userSchema = new Schema<IUser>({

  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    select: false 
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  isAdmin:{
    type: Boolean,
    default: false,
    required: true,
  }, 
  images: [{
    type: String,
    ref: 'Image'
  }],

}, {
  timestamps: true
});

// Hash pasword 
userSchema.pre('save', async function (next){
  if(!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as CallbackError);
  }
});

//Alternative handling of cascading deletes, currently using transaction inside userRepository instead
// userSchema.pre('deleteOne', async function (next) {
//   const userId = this.getQuery()["_id"];
//   await Image.deleteMany({ userId });
//   next();
// });


userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = model<IUser>('User', userSchema);
export default User;