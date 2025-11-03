import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "../../../services/real-time-feed.service";

@injectable()
export class MessageSentHandler implements IRealtimeMessageHandler {
	readonly messageType = "message_sent";

	async handle(io: any, message: FeedUpdateMessage, channel?: string): Promise<void> {
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
}
