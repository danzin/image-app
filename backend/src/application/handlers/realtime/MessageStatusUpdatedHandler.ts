import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "@/services/real-time-feed.service";
import { logger } from "@/utils/winston";

@injectable()
export class MessageStatusUpdatedHandler implements IRealtimeMessageHandler {
	readonly messageType = "message_status_updated";

	async handle(io: any, message: FeedUpdateMessage, channel?: string): Promise<void> {
		if (!message.conversationId || !message.status) return;

		const recipients = Array.isArray(message.recipients) ? message.recipients : [];
		const uniqueRecipients = new Set<string>(recipients);
		uniqueRecipients.delete("");

		for (const userId of uniqueRecipients) {
			io.to(userId).emit("messaging_update", {
				type: "message_status_updated",
				conversationId: message.conversationId,
				status: message.status,
				timestamp: message.timestamp,
			});
		}

		logger.info(
			`Real-time message status update sent via ${channel || "feed_updates"} for conversation ${message.conversationId}`,
		);
	}
}
