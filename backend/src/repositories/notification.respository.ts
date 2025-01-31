import mongoose, { ClientSession, Model } from "mongoose";
import Notification from "../models/notification.model";
import { INotification } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class NotificationRepository extends BaseRepository<INotification>{

  constructor(@inject('NotificationModel') model: Model<INotification>) {
    super(model)
  }
  
  async create(notificationData: Partial<INotification>, session?: ClientSession): Promise<INotification> {
    const notification = new this.model(notificationData);
    return await notification.save({ session });
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