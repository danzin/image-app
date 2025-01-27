import mongoose from 'mongoose';
import { NotificationRepository } from '../repositories/notification.respository';
import { INotification } from '../types';
import { createError } from '../utils/errors';

export class NotificationService {
  private notificationRepository: NotificationRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
  }

  async createNotification(data: {
    userId: string;       // User receiving the notification (e.g., followee)
    actionType: string;   // Type of action: 'follow', 'like', 'comment'
    actorId: string;      // User who triggered the action (e.g., follower)
    targetId?: string;    // Optional: ID of the affected resource (e.g., image ID)
  }): Promise<INotification> {
    // Validate required fields
    if (!data.userId || !data.actionType || !data.actorId) {
      throw createError("ValidationError", "Missing required notification fields");
    }

    try {
      // Convert string IDs to ObjectId
      const userId = new mongoose.Types.ObjectId(data.userId);
      const actorId = new mongoose.Types.ObjectId(data.actorId);
      const targetId = data.targetId ? new mongoose.Types.ObjectId(data.targetId) : undefined;

      // Create the notification
      return await this.notificationRepository.create({
        userId,
        actionType: data.actionType,
        actorId,
        targetId,
        isRead: false,
        timestamp: new Date(),
      } as INotification);
    } catch (error) {
    throw createError("InternalServerError", "Failed to create notification");
    }
  }

  async getNotifications(userId: string) {
    try {
      return await this.notificationRepository.getNotifications(userId);
    } catch (error) {
      throw createError('InternalServerError', 'Failed to fetch notifications');
    }
  }

  async markAsRead(notificationId: string) {
    try {
      return await this.notificationRepository.markAsRead(notificationId);
    } catch (error) {
      throw createError('InternalServerError', 'Failed to mark notification as read');
    }
  }
  
}