import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "@/services/real-time-feed.service";
import { logger } from "@/utils/winston";

@injectable()
export class InteractionMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "interaction";

	async handle(io: any, message: FeedUpdateMessage): Promise<void> {
		if (!message.userId || !message.targetId) return;

		// notify the content owner about the interaction
		// this would require looking up the owner of the target content

		io.emit("feed_interaction", {
			type: "user_interaction",
			userId: message.userId,
			actionType: message.actionType,
			targetId: message.targetId,
			tags: message.tags,
			timestamp: message.timestamp,
		});

		logger.info(`Real-time interaction notification sent for ${message.actionType} on ${message.targetId}`);
	}
}
