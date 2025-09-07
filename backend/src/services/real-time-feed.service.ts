import { inject, injectable } from "tsyringe";
import { RedisService } from "./redis.service";
import { WebSocketServer } from "../server/socketServer";

export interface FeedUpdateMessage {
	type: "new_image" | "interaction" | "like_update" | "avatar_changed";
	userId?: string;
	uploaderId?: string;
	imageId?: string;
	targetId?: string;
	actionType?: string;
	tags?: string[];
	affectedUsers?: string[];
	newLikes?: number;
	oldAvatar?: string;
	newAvatar?: string;
	timestamp: string;
}

@injectable()
export class RealTimeFeedService {
	constructor(
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("WebSocketServer") private readonly webSocketServer: WebSocketServer
	) {
		this.initializePubSubListener();
	}

	/**
	 * Initialize Redis pub/sub listener for feed updates
	 */
	private async initializePubSubListener(): Promise<void> {
		try {
			await this.redisService.subscribe(["feed_updates"], (channel: string, message: FeedUpdateMessage) => {
				this.handleFeedUpdate(message);
			});
			console.log("Real-time feed update listener initialized");
		} catch (error) {
			console.error("Failed to initialize real-time feed listener:", error);
		}
	}

	/**
	 * Handle incoming feed update messages
	 */
	private async handleFeedUpdate(message: FeedUpdateMessage): Promise<void> {
		try {
			const io = this.webSocketServer.getIO();

			switch (message.type) {
				case "new_image":
					await this.handleNewImageUpdate(io, message);
					break;
				case "interaction":
					await this.handleInteractionUpdate(io, message);
					break;
				case "like_update":
					await this.handleLikeUpdate(io, message);
					break;
				case "avatar_changed":
					await this.handleAvatarUpdate(io, message);
					break;
				default:
					console.warn("Unknown feed update type:", message.type);
			}
		} catch (error) {
			console.error("Error handling feed update:", error);
		}
	}

	/**
	 * Handle new image upload notifications
	 */
	private async handleNewImageUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		if (!message.affectedUsers || !message.uploaderId) return;

		// Notify affected users about new content in their feed
		for (const userId of message.affectedUsers) {
			io.to(userId).emit("feed_update", {
				type: "new_image",
				uploaderId: message.uploaderId,
				imageId: message.imageId,
				tags: message.tags,
				timestamp: message.timestamp,
			});
		}

		// Also notify the uploader
		io.to(message.uploaderId).emit("feed_update", {
			type: "image_uploaded",
			imageId: message.imageId,
			tags: message.tags,
			timestamp: message.timestamp,
		});

		console.log(
			`Real-time notification sent for new image ${message.imageId} to ${message.affectedUsers.length} users`
		);
	}

	/**
	 * Handle user interaction notifications
	 */
	private async handleInteractionUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		if (!message.userId || !message.targetId) return;

		// Notify the content owner about the interaction
		// This would require looking up the owner of the target content
		// For now, we'll broadcast to followers or interested users

		io.emit("feed_interaction", {
			type: "user_interaction",
			userId: message.userId,
			actionType: message.actionType,
			targetId: message.targetId,
			tags: message.tags,
			timestamp: message.timestamp,
		});

		console.log(`Real-time interaction notification sent for ${message.actionType} on ${message.targetId}`);
	}

	/**
	 * Handle like count updates
	 */
	private async handleLikeUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		if (!message.imageId || message.newLikes === undefined) return;

		// Broadcast like count update to all connected users
		// In a more sophisticated implementation, you might track which users have this image in their feed
		io.emit("like_update", {
			type: "like_count_changed",
			imageId: message.imageId,
			newLikes: message.newLikes,
			timestamp: message.timestamp,
		});

		console.log(`Real-time like update sent for image ${message.imageId}: ${message.newLikes} likes`);
	}

	/**
	 * Handle avatar change notifications
	 */
	private async handleAvatarUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		if (!message.userId) return;

		// Notify all users about avatar change (since avatars appear in feeds)
		io.emit("avatar_update", {
			type: "user_avatar_changed",
			userId: message.userId,
			oldAvatar: message.oldAvatar,
			newAvatar: message.newAvatar,
			timestamp: message.timestamp,
		});

		console.log(`Real-time avatar update sent for user ${message.userId}`);
	}

	/**
	 * Send a custom real-time notification to specific users
	 */
	async notifyUsers(userIds: string[], event: string, data: any): Promise<void> {
		const io = this.webSocketServer.getIO();

		for (const userId of userIds) {
			io.to(userId).emit(event, data);
		}
	}

	/**
	 * Broadcast a message to all connected users
	 */
	async broadcast(event: string, data: any): Promise<void> {
		const io = this.webSocketServer.getIO();
		io.emit(event, data);
	}
}
