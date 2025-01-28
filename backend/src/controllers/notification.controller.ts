import { Request, Response, NextFunction } from 'express';
import { NotificationService } from '../services/notification.service';
import { createError } from '../utils/errors';

export class NotificationController {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async getNotifications(req: Request, res: Response, next: NextFunction) {
    try {
      const notifications = await this.notificationService.getNotifications(req.decodedUser.id);
      res.status(200).json(notifications);
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req: Request, res: Response, next: NextFunction) {
    try {
      const notification = await this.notificationService.markAsRead(req.params.id);
      res.status(200).json(notification);
    } catch (error) {
      next(error);
    }
  }
}