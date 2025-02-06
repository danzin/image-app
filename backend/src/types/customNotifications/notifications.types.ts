import mongoose, { Document } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;       
  actionType: string;   
  actorId: mongoose.Types.ObjectId;     
  targetId?: mongoose.Types.ObjectId;    
  isRead: boolean;
  timestamp: Date;
}
