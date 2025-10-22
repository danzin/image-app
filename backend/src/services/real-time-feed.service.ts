import { inject, injectable } from "tsyringe";
import { RedisService } from "./redis.service";
import { WebSocketServer } from "../server/socketServer";

export interface FeedUpdateMessage {
	type:
		| "new_image"
		| "new_image_global"
		| "new_post"
		| "new_post_global"
		| "post_deleted"
		| "interaction"
		| "like_update"
		| "avatar_changed"
		| "message_sent";
	userId?: string;
	uploaderId?: string;
	imageId?: string;
	postId?: string;
	authorId?: string;
	targetId?: string;
	actionType?: string;
	tags?: string[];
	affectedUsers?: string[];
	newLikes?: number;
	oldAvatar?: string;
	newAvatar?: string;
	timestamp: string;
	conversationId?: string;
	senderId?: string;
	recipients?: string[];
	messageId?: string;
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
			// Subscribe to feed_updates and messaging_updates channels for real time feed updates and message delivery
			await this.redisService.subscribe(["feed_updates", "messaging_updates"], (channel: string, message: any) => {
				// Handle case where message might be a string that needs parsing
				let parsedMessage: FeedUpdateMessage;
				if (typeof message === "string") {
					try {
						parsedMessage = JSON.parse(message);
					} catch (error) {
						console.error("Failed to parse feed update message:", error);
						return;
					}
				} else {
					parsedMessage = message;
				}
				this.handleFeedUpdate(parsedMessage, channel);
			});
			console.log("Real-time feed update listener initialized");
		} catch (error) {
			console.error("Failed to initialize real-time feed listener:", error);
		}
	}

	/**
	 * Handle incoming feed update messages
	 */
	private async handleFeedUpdate(message: FeedUpdateMessage, channel?: string): Promise<void> {
		try {
			console.log("Real-time service received message:", JSON.stringify(message, null, 2));
			const io = this.webSocketServer.getIO();

			switch (message.type) {
				case "new_image":
				case "new_post":
					await this.handleNewPostUpdate(io, message);
					break;
				case "new_image_global":
				case "new_post_global":
					await this.handleGlobalNewPostUpdate(io, message);
					break;
				case "post_deleted":
					await this.handlePostDeleted(io, message);
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
				case "message_sent":
					await this.handleMessageSent(io, message, channel);
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
	private async handleNewPostUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		const authorId = message.authorId ?? message.uploaderId;
		const postId = message.postId ?? message.imageId;
		if (!authorId || !postId) return;

		// GLOBAL BROADCAST: Notify ALL users about new content for discovery feeds
		// This ensures the "new" feed updates immediately for everyone
		io.emit("discovery_update", {
			type: "new_post_global",
			authorId,
			postId,
			tags: message.tags,
			timestamp: message.timestamp,
		});

		// TARGETED NOTIFICATIONS: Notify specific users about content in their personalized feeds
		if (message.affectedUsers && message.affectedUsers.length > 0) {
			for (const userId of message.affectedUsers) {
				io.to(userId).emit("feed_update", {
					type: "new_post",
					authorId,
					postId,
					tags: message.tags,
					timestamp: message.timestamp,
				});
			}
		}

		// Also notify the uploader
		io.to(authorId).emit("feed_update", {
			type: "post_published",
			postId,
			tags: message.tags,
			timestamp: message.timestamp,
		});

		console.log(
			`Real-time notification sent globally for new post ${postId} + to ${
				message.affectedUsers?.length || 0
			} specific users`
		);
	}

	/**
	 * Handle user interaction notifications
	 */
	private async handleInteractionUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		if (!message.userId || !message.targetId) return;

		// Notify the content owner about the interaction
		// This would require looking up the owner of the target content

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
	 * Handle global new image notifications for discovery feeds
	 */
	private async handleGlobalNewPostUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		const postId = message.postId ?? message.imageId;
		if (!postId) return;

		// Get image details to include in the notification
		const imageData = {
			postId,
			userId: message.userId ?? message.authorId ?? message.uploaderId,
			tags: message.tags,
			timestamp: message.timestamp,
		};

		io.emit("discovery_new_post", {
			type: "new_post_global",
			data: imageData,
		});

		console.log(`Global new post notification sent for post ${postId} to all connected clients`);
	}

	private async handlePostDeleted(io: any, message: FeedUpdateMessage): Promise<void> {
		const postId = message.postId;
		if (!postId) return;

		io.emit("feed_update", {
			type: "post_deleted",
			postId,
			timestamp: message.timestamp,
		});

		console.log(`Real-time notification sent for post deletion ${postId}`);
	}

	/**
	 * Handle like count updates
	 */
	private async handleLikeUpdate(io: any, message: FeedUpdateMessage): Promise<void> {
		const targetId = message.postId ?? message.imageId;
		if (!targetId || message.newLikes === undefined) return;

		// Broadcast like count update to all connected users
		io.emit("like_update", {
			type: "like_count_changed",
			postId: targetId,
			imageId: targetId,
			newLikes: message.newLikes,
			timestamp: message.timestamp,
		});

		console.log(`Real-time like update sent for post ${targetId}: ${message.newLikes} likes`);
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
	 * Handle message sent
	 */
	private async handleMessageSent(io: any, message: FeedUpdateMessage, channel?: string): Promise<void> {
		if (!message.conversationId || !message.senderId) return;

		const recipients = Array.isArray(message.recipients) ? message.recipients : [];
		const uniqueRecipients = new Set<string>([message.senderId, ...recipients]);
		uniqueRecipients.delete("");

		for (const userId of uniqueRecipients) {
			io.to(userId).emit("messaging_update", {
				type: "message_sent",
				conversationId: message.conversationId,
				messageId: message.messageId,
				senderId: message.senderId,
				timestamp: message.timestamp,
			});
		}

		console.log(
			`Real-time messaging update sent via ${channel || "feed_updates"} for conversation ${message.conversationId}`
		);
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
