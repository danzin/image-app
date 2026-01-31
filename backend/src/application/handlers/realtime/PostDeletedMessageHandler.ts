import { injectable } from "tsyringe";
import { Server } from "socket.io";
import { IRealtimeMessageHandler } from "../realtime/IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "@/services/real-time-feed.service";
import { logger } from "@/utils/winston";

@injectable()
export class PostDeletedMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "post_deleted";

	async handle(io: Server, message: FeedUpdateMessage): Promise<void> {
		const postId = message.postId;
		if (!postId) return;

		io.emit("feed_update", {
			type: "post_deleted",
			postId,
			timestamp: message.timestamp,
		});

		logger.info(`Real-time notification sent for post deletion ${postId}`);
	}
}
