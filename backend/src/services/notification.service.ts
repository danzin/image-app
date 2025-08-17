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
			// Ensure we emit a plain JSON object (strip Mongoose internals)
			const plain =
				typeof (notification as any).toObject === "function"
					? (notification as any).toObject()
					: { ...(notification as any) };
			if (plain._id && !plain.id) plain.id = String(plain._id);
			// Remove any circular/internal fields
			delete (plain as any).$__; // Mongoose internal cache
			console.log(`Sending new_notification to user ${userPublicId}:`, plain);
			io.to(userPublicId).emit("new_notification", plain);
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
			const plain =
				typeof (notification as any).toObject === "function"
					? (notification as any).toObject()
					: { ...(notification as any) };
			if (plain._id && !plain.id) plain.id = String(plain._id);
			delete (plain as any).$__;
			console.log(`Sending notification_read to user ${userPublicId}:`, plain);
			io.to(userPublicId).emit("notification_read", plain);
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
		actorUsername?: string; // optional actor username provided by frontend
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
			const actorUsername = data.actorUsername?.trim();

			const io = this.getIO();

			// Save notification to the database
			const notification = await this.notificationRepository.create(
				{
					userId: userPublicId,
					actionType: data.actionType,
					actorId: actorPublicId,
					actorUsername,
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
			const notifications = await this.notificationRepository.getNotifications(userPublicId);
			return notifications;
		} catch (error) {
			if (error instanceof Error) {
				throw createError("InternalServerError", error.message);
			} else {
				throw createError("InternalServerError", String(error));
			}
		}
	}

	async markAsRead(notificationId: string, userPublicId: string) {
		try {
			console.log(`[NotificationService] markAsRead requested id=${notificationId} userPublicId=${userPublicId}`);
			const io = this.getIO();
			const updatedNotification = await this.notificationRepository.markAsRead(notificationId, userPublicId);
			if (!updatedNotification) {
				console.log(`[NotificationService] markAsRead not found id=${notificationId} userPublicId=${userPublicId}`);
				throw createError("PathError", "Notification not found");
			}
			console.log(`[NotificationService] markAsRead updated id=${notificationId} userPublicId=${userPublicId}`);
			this.readNotification(io, userPublicId, updatedNotification);
			return updatedNotification;
		} catch (error) {
			// If already an AppError (has statusCode) rethrow
			if (typeof error === "object" && error && "statusCode" in (error as any)) throw error as any;
			if (error instanceof Error) throw createError(error.name, error.message);
			throw createError("UnknownError", String(error));
		}
	}
}
