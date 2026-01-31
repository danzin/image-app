import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "@/services/real-time-feed.service";
import { logger } from "@/utils/winston";

@injectable()
export class NewPostMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "new_post";

	async handle(io: any, message: FeedUpdateMessage): Promise<void> {
		const authorId = message.authorId ?? message.uploaderId;
		const postId = message.postId ?? message.imageId;
		if (!authorId || !postId) return;

		// TARGETED NOTIFICATIONS: notify specific users about content in their personalized feeds
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

		// also notify the uploader
		io.to(authorId).emit("feed_update", {
			type: "post_published",
			postId,
			tags: message.tags,
			timestamp: message.timestamp,
		});

		logger.info(
			`Real-time notification sent to ${message.affectedUsers?.length || 0} specific users for new post ${postId}`,
		);
	}
}
