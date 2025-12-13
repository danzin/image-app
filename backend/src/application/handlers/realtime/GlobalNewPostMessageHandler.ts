import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "../../../services/real-time-feed.service";
import { logger } from "../../../utils/winston";

@injectable()
export class GlobalNewPostMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "new_post_global";

	async handle(io: any, message: FeedUpdateMessage): Promise<void> {
		const postId = message.postId ?? message.imageId;
		if (!postId) return;

		logger.info(`Skipping global new post notification for post ${postId} - lazy refresh strategy enabled`);
	}
}
