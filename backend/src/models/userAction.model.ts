import mongoose, { Schema, Document } from 'mongoose';
import { IUserAction } from '../types';


const userActionSchema = new Schema<IUserAction>({
  userId: { type: String, required: true },
  actionType: { type: String, required: true },
  targetId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
});

const UserAction = mongoose.model<IUserAction>('UserAction', userActionSchema);
export default UserAction;