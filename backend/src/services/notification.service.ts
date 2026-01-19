import { ClientSession } from "mongoose";
import { NotificationRepository } from "../repositories/notification.respository";
import { INotification, NotificationPlain } from "../types";
import { createError, isErrorWithStatusCode } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { Server as SocketIOServer } from "socket.io";
import { WebSocketServer } from "../server/socketServer";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";
import { RedisService } from "./redis.service";
import { redisLogger, errorLogger, logger } from "../utils/winston";

@injectable()
export class NotificationService {
	// cache TTL: 30 days for notification hashes
	private readonly NOTIFICATION_CACHE_TTL = 2592000;
	private readonly MAX_NOTIFICATIONS_PER_USER = 200;

	constructor(
		@inject("WebSocketServer") private webSocketServer: WebSocketServer,
		@inject("NotificationRepository") private notificationRepository: NotificationRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("ImageRepository") private imageRepository: ImageRepository,
		@inject("RedisService") private redisService: RedisService
	) {}

	private getIO(): SocketIOServer {
		return this.webSocketServer.getIO();
	}

	private sendNotification(io: SocketIOServer, userPublicId: string, notification: INotification) {
		try {
			// emit a plain JSON object using toJSON for proper serialization
			const plain: NotificationPlain = notification.toJSON ? notification.toJSON() : { ...notification };

			if (plain._id && !plain.id) {
				plain.id = String(plain._id);
			}

			delete plain._id;
			delete plain.$__;

			logger.info(`Sending new_notification to user ${userPublicId}:`, { notification: plain });
			io.to(userPublicId).emit("new_notification", plain);
			logger.info("Notification sent successfully");
		} catch (error) {
			logger.error("Error sending notification:", { error });
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	private readNotification(io: SocketIOServer, userPublicId: string, notification: INotification) {
		try {
			const plain: NotificationPlain = notification.toJSON ? notification.toJSON() : { ...notification };

			if (plain._id && !plain.id) {
				plain.id = String(plain._id);
			}

			delete plain._id;
			delete plain.$__;

			logger.info(`Sending notification_read to user ${userPublicId}:`, { notification: plain });
			io.to(userPublicId).emit("notification_read", plain);
			logger.info("Notification read event sent successfully");
		} catch (error) {
			logger.error("Error sending notification read event:", { error });
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	async createNotification(data: {
		receiverId: string; // user publicId
		actionType: string; // like, comment, follow, etc
		actorId: string; // actor publicId
		targetId?: string; // optional target publicId (e.g., post publicId)
		targetType?: string; // 'post' | 'image' | 'user'
		targetPreview?: string; // preview text/snippet
		actorUsername?: string; // optional actor username provided by frontend
		actorAvatar?: string; // optional actor avatar URL
		session?: ClientSession;
	}): Promise<INotification> {
		if (!data.receiverId || !data.actionType || !data.actorId) {
			throw createError("ValidationError", "Missing required notification fields");
		}

		try {
			//trust publicIds from frontend
			const userPublicId = data.receiverId.trim();
			const actorPublicId = data.actorId.trim();
			const targetPublicId = data.targetId?.trim();
			const actorUsername = data.actorUsername?.trim();
			const actorAvatar = data.actorAvatar?.trim();
			const targetType = data.targetType?.trim();
			const targetPreview = data.targetPreview?.trim();

			const io = this.getIO();

			const notification = await this.notificationRepository.create(
				{
					userId: userPublicId,
					actionType: data.actionType,
					actorId: actorPublicId,
					actorUsername,
					actorAvatar,
					targetId: targetPublicId,
					targetType,
					targetPreview,
					isRead: false,
					timestamp: new Date(),
				},
				data.session // pass the session
			);

			// emit via WebSocket
			this.sendNotification(io, userPublicId, notification);

			// push to Redis List+Hash using new pattern
			await this.redisService.pushNotification(userPublicId, notification, this.MAX_NOTIFICATIONS_PER_USER);

			return notification;
		} catch (error) {
			logger.error(`notificationRepository.create error:`, { error });
			throw createError("InternalServerError", "Failed to create notification");
		}
	}

	/**
	 * Get notifications for a user (using Redis List+Hash pattern)
	 * Supports cursor-based pagination with timestamps
	 *
	 * @param userId - user publicId
	 * @param limit - number of notifications to fetch (default: 20)
	 * @param before - timestamp cursor for pagination (fetch notifications older than this)
	 */
	async getNotifications(userId: string, limit: number = 20, before?: number): Promise<INotification[]> {
		redisLogger.debug(`getNotifications called`, { userId, before, limit });

		try {
			// if cursor-based pagination (before timestamp), skip Redis and go to MongoDB
			if (before) {
				redisLogger.info(`Cursor-based pagination, fetching from DB`, { userId, before });
				const beforeDate = new Date(before);
				const dbNotifications = await this.notificationRepository.getNotificationsBeforeTimestamp(
					userId,
					beforeDate,
					limit
				);
				redisLogger.debug(`DB returned notifications`, { userId, count: dbNotifications.length });
				return dbNotifications;
			}

			// initial page load - try Redis cache first
			const notifications = await this.redisService.getUserNotifications(userId, 1, limit);

			if (notifications.length >= limit) {
				redisLogger.info(`Notification Redis HIT`, { userId, count: notifications.length });
				return notifications;
			}

			// cache miss - fetch from MongoDB
			redisLogger.info(`Notification Redis MISS, fetching from DB`, { userId });
			const dbNotifications = await this.notificationRepository.getNotifications(userId, limit, 0);

			redisLogger.debug(`DB returned notifications`, { userId, count: dbNotifications.length });

			// backfill cache in correct order (newest-first)
			if (dbNotifications.length > 0) {
				this.redisService
					.backfillNotifications(userId, dbNotifications, this.MAX_NOTIFICATIONS_PER_USER)
					.catch((err: Error) => {
						errorLogger.error(`Failed to backfill notification cache`, {
							userId,
							error: err.message,
						});
					});
			}

			return dbNotifications;
		} catch (error) {
			errorLogger.error(`getNotifications error`, {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			if (error instanceof Error) {
				throw createError("InternalServerError", error.message);
			} else {
				throw createError("InternalServerError", String(error));
			}
		}
	}

	async markAsRead(notificationId: string, userPublicId: string) {
		try {
			logger.info(`[NotificationService] markAsRead requested`, { notificationId, userPublicId });
			const io = this.getIO();
			const updatedNotification = await this.notificationRepository.markAsRead(notificationId, userPublicId);
			if (!updatedNotification) {
				logger.info(`[NotificationService] markAsRead not found`, { notificationId, userPublicId });
				throw createError("PathError", "Notification not found");
			}
			logger.info(`[NotificationService] markAsRead updated`, { notificationId, userPublicId });
			this.readNotification(io, userPublicId, updatedNotification);

			// update in Redis hash (O(1) operation)
			await this.redisService.markNotificationRead(notificationId);

			return updatedNotification;
		} catch (error) {
			// if already an AppError with statuscode then rethrow
			if (isErrorWithStatusCode(error)) throw error;
			if (error instanceof Error) throw createError(error.name, error.message);
			throw createError("UnknownError", String(error));
		}
	}

	/**
	 * Get unread notification count for a user using Redis
	 */
	async getUnreadCount(userPublicId: string): Promise<number> {
		try {
			// try Redis first for fast count
			const count = await this.redisService.getUnreadNotificationCount(userPublicId);
			if (count >= 0) {
				return count;
			}

			// fallback to DB if Redis fails
			return await this.notificationRepository.getUnreadCount(userPublicId);
		} catch (error) {
			// fallback to DB on error
			logger.warn(`[NotificationService] Redis error getting unread count, falling back to DB:`, { error });
			return await this.notificationRepository.getUnreadCount(userPublicId);
		}
	}

	async markAllAsRead(userPublicId: string): Promise<number> {
		try {
			const modifiedCount = await this.notificationRepository.markAllAsRead(userPublicId);

			if (modifiedCount > 0) {
				// update all notification hashes in Redis
				// fetch the list and update each one
				const notificationIds = await this.redisService.get(`notifications:user:${userPublicId}`);
				if (Array.isArray(notificationIds)) {
					await Promise.all(notificationIds.map((id: string) => this.redisService.markNotificationRead(id)));
				}

				// emit WebSocket event
				const io = this.getIO();
				io.to(userPublicId).emit("all_notifications_read");
			}

			return modifiedCount;
		} catch (error) {
			if (error instanceof Error) {
				throw createError("InternalServerError", error.message);
			}
			throw createError("InternalServerError", String(error));
		}
	}
}
