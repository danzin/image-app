import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "../../../services/real-time-feed.service";

@injectable()
export class GlobalNewPostMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "new_post_global";

	async handle(io: any, message: FeedUpdateMessage): Promise<void> {
		const postId = message.postId ?? message.imageId;
		if (!postId) return;

		// get image details to include in the notification
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
}
