import mongoose, { ClientSession } from "mongoose";
import { NotificationRepository } from "../repositories/notification.respository";
import { INotification } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { Server as SocketIOServer } from "socket.io";
import { Client } from "socket.io/dist/client";
import { WebSocketServer } from "../server/socketServer";

@injectable()
export class NotificationService {
	constructor(
		@inject("WebSocketServer") private webSocketServer: WebSocketServer,
		@inject("NotificationRepository") private notificationRepository: NotificationRepository
	) {}

	private getIO(): SocketIOServer {
		return this.webSocketServer.getIO();
	}

	private sendNotification(io: SocketIOServer, userId: mongoose.Types.ObjectId, notification: INotification) {
		try {
			console.log(`Sending new_notification to user ${userId}:`, notification);
			io.to(userId.toString()).emit("new_notification", notification);
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

	private readNotification(io: SocketIOServer, userId: string, notification: INotification) {
		try {
			console.log(`Sending notification_read to user ${userId}:`, notification);
			io.to(userId.toString()).emit("notification_read", notification);
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
		receiverId: string; // User receiving the notification
		actionType: string; // Type of action: like, follow
		actorId: string; // User who triggered the action
		targetId?: string; // Optional: ID of the affected resource (e.g., image ID)
		session?: ClientSession;
	}): Promise<INotification> {
		// Validate required fields
		if (!data.receiverId || !data.actionType || !data.actorId) {
			throw createError("ValidationError", "Missing required notification fields");
		}

		try {
			const userId = new mongoose.Types.ObjectId(data.receiverId);
			const actorId = new mongoose.Types.ObjectId(data.actorId);
			const targetId = data.targetId ? new mongoose.Types.ObjectId(data.targetId) : undefined;
			const io = this.getIO();

			// Save notification to the database
			const notification = await this.notificationRepository.create(
				{
					userId,
					actionType: data.actionType,
					actorId,
					targetId,
					isRead: false,
					timestamp: new Date(),
				},
				data.session // Pass session to ensure transaction safety\
			);

			//Send instant notification to user via Socket.io
			this.sendNotification(io, userId, notification);

			return notification;
		} catch (error) {
			console.error(`notificationRepository.create error: ${error}`);
			throw createError("InternalServerError", "Failed to create notification");
		}
	}

	async getNotifications(userId: string) {
		try {
			return await this.notificationRepository.getNotifications(userId);
		} catch (error) {
			throw createError("InternalServerError", "Failed to fetch notifications");
		}
	}

	async markAsRead(notificationId: string, userId: string) {
		try {
			const io = this.getIO();

			// Update the notification as read
			const updatedNotification = await this.notificationRepository.markAsRead(notificationId);

			if (!updatedNotification) {
				throw createError("NotFoundError", "Notification not found");
			}

			// Emit the real-time event via websocket
			this.readNotification(io, userId, updatedNotification);

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
