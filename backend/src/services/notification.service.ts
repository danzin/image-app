import mongoose from 'mongoose';
import { NotificationRepository } from '../repositories/notification.respository';
import { INotification } from '../types';
import { createError } from '../utils/errors';
import { inject, injectable } from 'tsyringe';

@injectable()
export class NotificationService {

  constructor(@inject('NotificationRepository') private readonly notificationRepository: NotificationRepository) 
  {}

  async createNotification(data: {
    userId: string;       // User receiving the notification 
    actionType: string;   // Type of action: like, follow
    actorId: string;      // User who triggered the action 
    targetId?: string;    // Optional: ID of the affected resource (e.g., image ID)
  }): Promise<INotification> {
    // Validate required fields
    if (!data.userId || !data.actionType || !data.actorId) {
      throw createError("ValidationError", "Missing required notification fields");
    }

    try {
      const userId = new mongoose.Types.ObjectId(data.userId);
      const actorId = new mongoose.Types.ObjectId(data.actorId);
      const targetId = data.targetId ? new mongoose.Types.ObjectId(data.targetId) : undefined;

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