import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "../realtime/IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "../../../services/real-time-feed.service";

@injectable()
export class PostDeletedMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "post_deleted";

	async handle(io: any, message: FeedUpdateMessage): Promise<void> {
		const postId = message.postId;
		if (!postId) return;

		io.emit("feed_update", {
			type: "post_deleted",
			postId,
			timestamp: message.timestamp,
		});

		console.log(`Real-time notification sent for post deletion ${postId}`);
	}
}
