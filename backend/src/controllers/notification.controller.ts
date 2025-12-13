import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { logger } from "../utils/winston";

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

			// cursor-based pagination support
			const beforeStr = req.query.before as string | undefined;
			const before = beforeStr ? parseInt(beforeStr, 10) : undefined;
			const limit = parseInt(req.query.limit as string) || 20;

			// validate pagination params
			if (limit < 1 || limit > 100) {
				throw createError("ValidationError", "Limit must be between 1 and 100");
			}

			if (before !== undefined && (isNaN(before) || before < 0)) {
				throw createError("ValidationError", "Invalid 'before' timestamp");
			}

			const notifications = await this.notificationService.getNotifications(userPublicId, limit, before);

			logger.info(
				`[NOTIFICATIONS] Fetched ${notifications.length} notifications for user: ${userPublicId}` +
					(before ? ` (before: ${new Date(before).toISOString()})` : " (initial load)")
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
			const userPublicId = (decodedUser as any).publicId;
			const notification = await this.notificationService.markAsRead(notificationId, userPublicId);
			res.status(200).json(notification);
		} catch (error) {
			next(error);
		}
	};

	getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			if (!decodedUser || !(decodedUser as any).publicId) {
				throw createError("ValidationError", "User publicId is required");
			}
			const userPublicId = (decodedUser as any).publicId;
			const count = await this.notificationService.getUnreadCount(userPublicId);
			res.status(200).json({ count });
		} catch (error) {
			next(error);
		}
	};

	markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { decodedUser } = req;
			if (!decodedUser || !(decodedUser as any).publicId) {
				throw createError("ValidationError", "User publicId is required");
			}
			const userPublicId = (decodedUser as any).publicId;
			const modifiedCount = await this.notificationService.markAllAsRead(userPublicId);
			res.status(200).json({ modifiedCount });
		} catch (error) {
			next(error);
		}
	};
}
