import { ClientSession } from "mongoose";
import { NotificationRepository } from "../repositories/notification.respository";
import { INotification } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { Server as SocketIOServer } from "socket.io";
import { Client } from "socket.io/dist/client";
import { WebSocketServer } from "../server/socketServer";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";

@injectable()
export class NotificationService {
	constructor(
		@inject("WebSocketServer") private webSocketServer: WebSocketServer,
		@inject("NotificationRepository") private notificationRepository: NotificationRepository,
		@inject("UserRepository") private userRepository: UserRepository,
		@inject("ImageRepository") private imageRepository: ImageRepository
	) {}

	private getIO(): SocketIOServer {
		return this.webSocketServer.getIO();
	}

	private sendNotification(io: SocketIOServer, userPublicId: string, notification: INotification) {
		try {
			console.log(`Sending new_notification to user ${userPublicId}:`, notification);
			io.to(userPublicId).emit("new_notification", notification);
			console.log("Notification sent successfully");
		} catch (error) {
			console.error("Error sending notification:", error);
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	private readNotification(io: SocketIOServer, userPublicId: string, notification: INotification) {
		try {
			console.log(`Sending notification_read to user ${userPublicId}:`, notification);
			io.to(userPublicId).emit("notification_read", notification);
			console.log("Notification sent successfully");
		} catch (error) {
			console.error("Error sending notification:", error);
			if (error instanceof Error) {
				throw createError(error.name, error.message);
			} else {
				throw createError("UnknownError", String(error));
			}
		}
	}

	async createNotification(data: {
		receiverId: string; // user publicId
		actionType: string; // like, follow, etc
		actorId: string; // actor publicId
		targetId?: string; // optional target publicId (e.g., image publicId)
		session?: ClientSession;
	}): Promise<INotification> {
		// Validate required fields
		if (!data.receiverId || !data.actionType || !data.actorId) {
			throw createError("ValidationError", "Missing required notification fields");
		}

		try {
			// No ObjectId resolution; trust publicIds from frontend
			const userPublicId = data.receiverId.trim();
			const actorPublicId = data.actorId.trim();
			const targetPublicId = data.targetId?.trim();

			const io = this.getIO();

			// Save notification to the database
			const notification = await this.notificationRepository.create(
				{
					userId: userPublicId,
					actionType: data.actionType,
					actorId: actorPublicId,
					targetId: targetPublicId,
					isRead: false,
					timestamp: new Date(),
				},
				data.session // Pass session to ensure transaction safety\
			);

			//Send instant notification to user via Socket.io
			this.sendNotification(io, userPublicId, notification);

			return notification;
		} catch (error) {
			console.error(`notificationRepository.create error: ${error}`);
			throw createError("InternalServerError", "Failed to create notification");
		}
	}

	async getNotifications(userPublicId: string) {
		try {
			return await this.notificationRepository.getNotifications(userPublicId);
		} catch (error) {
			throw createError("InternalServerError", "Failed to fetch notifications");
		}
	}

	async markAsRead(notificationId: string, userPublicId: string) {
		try {
			const io = this.getIO();

			// Update the notification as read
			const updatedNotification = await this.notificationRepository.markAsRead(notificationId);

			if (!updatedNotification) {
				throw createError("NotFoundError", "Notification not found");
			}

			// Emit the real-time event via websocket using publicId room
			this.readNotification(io, userPublicId, updatedNotification);

			return updatedNotification;
		} catch (error) {
			if (error instanceof Error) {
				throw createError("InternalServerError", error.message);
			} else {
				throw createError("InternalServerError", String(error));
			}
		}
	}
}
