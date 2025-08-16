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
			if (!decodedUser || !(decodedUser as any).publicId) {
				throw createError("ValidationError", "User publicId is required");
			}
			const userPublicId = (decodedUser as any).publicId;
			const notifications = await this.notificationService.getNotifications(userPublicId);
			console.log(
				`[NOTIFICATIONS] Fetched notifications for user: ${userPublicId} \r\n [NOTIFICATIONS] ${JSON.stringify(
					notifications
				)}`
			);

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
			if (!decodedUser || !(decodedUser as any).publicId) {
				throw createError("ValidationError", "User publicId is required");
			}
			console.log(`[NOTIFICATIONS] markAsRead attempt id=${notificationId}`);
			const userPublicId = (decodedUser as any).publicId;
			const notification = await this.notificationService.markAsRead(notificationId, userPublicId);
			res.status(200).json(notification);
		} catch (error) {
			console.error("[NOTIFICATIONS] markAsRead error:", error);
			next(error);
		}
	};
}
