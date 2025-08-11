import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class NotificationController {
	constructor(@inject("NotificationService") private readonly notificationService: NotificationService) {}

	getNotifications = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			if (!decodedUser || !decodedUser.id) {
				throw createError("ValidationError", "User ID is required");
			}
			const notifications = await this.notificationService.getNotifications(decodedUser.id);

			res.status(200).json(notifications);
		} catch (error) {
			console.error(error);
			next(error);
		}
	};

	markAsRead = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { notificationId } = req.params;
			const { decodedUser } = req;
			if (!decodedUser || !decodedUser.id) {
				throw createError("ValidationError", "User ID is required");
			}
			const notification = await this.notificationService.markAsRead(notificationId, decodedUser.id);
			res.status(200).json(notification);
		} catch (error) {
			console.error(error);
			next(error);
		}
	};
}
