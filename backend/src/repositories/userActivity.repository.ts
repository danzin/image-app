import mongoose from "mongoose";
import UserAction from "../models/userAction.model";
import Notification from "../models/notification.model";
import { INotification, IUserAction } from "../types";

export class UserActionRepository {
  private model: mongoose.Model<IUserAction>;
  private notificationModel: mongoose.Model<INotification>;

  constructor() {
    this.model = UserAction;
    this.notificationModel = Notification;
  }

  async logAction(userId: string, actionType: string, targetId: string): Promise<void> {
    const userAction = new this.model({ userId, actionType, targetId });
    await userAction.save();

    // Trigger a notification for the target user
    if (actionType === 'like' || actionType === 'follow') {
      const notification = new this.notificationModel({
        userId: targetId, // The user being followed or whose image was liked
        actionType,
        actionId: userAction._id, // Reference to the action
      });
      await notification.save();
    }
  }

  async getActionsByUser(userId: string): Promise<IUserAction[]> {
    return this.model.find({ userId }).exec();
  }
}