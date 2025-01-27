import mongoose from "mongoose";
import Notification from "../models/notification.model";
import { INotification } from "../types";

export class NotificationRepository {
  private model: mongoose.Model<INotification>;

  constructor() {
    this.model = Notification;
  }
  
  async create(notificationData: INotification): Promise<INotification> {
    try {
      const notification = new this.model(notificationData);
      return await notification.save();
    } catch (error) {
      throw new Error("Failed to create notification");
    }
  }

  async getNotifications(userId: string) {
    return this.model.find({ userId }).sort({ timestamp: -1 }).exec();
  }

  async markAsRead(notificationId: string) {
    return this.model.findByIdAndUpdate(
      notificationId,
      { $set: { isRead: true } },
      { new: true }
    );
  }
}