import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "../../../services/real-time-feed.service";
import { logger } from "../../../utils/winston";

@injectable()
export class LikeUpdateMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "like_update";

	async handle(io: any, message: FeedUpdateMessage): Promise<void> {
		const targetId = message.postId ?? message.imageId;
		if (!targetId || message.newLikes === undefined) return;

		// broadcast like count update to all connected users
		io.emit("like_update", {
			type: "like_count_changed",
			postId: targetId,
			imageId: targetId,
			newLikes: message.newLikes,
			timestamp: message.timestamp,
		});

		logger.info(`Real-time like update sent for post ${targetId}: ${message.newLikes} likes`);
	}
}
