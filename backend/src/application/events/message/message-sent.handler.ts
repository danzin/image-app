import { inject, injectable } from "tsyringe";
import { IEventHandler } from "@/application/common/interfaces/event-handler.interface";
import { MessageSentEvent } from "@/application/events/message/message.event";
import { RedisService } from "@/services/redis.service";

@injectable()
export class MessageSentHandler implements IEventHandler<MessageSentEvent> {
	constructor(@inject("RedisService") private readonly redisService: RedisService) {}

	async handle(event: MessageSentEvent): Promise<void> {
		await this.redisService.publish(
			"messaging_updates",
			JSON.stringify({
				type: "message_sent",
				conversationId: event.conversationPublicId,
				senderId: event.senderPublicId,
				recipients: event.recipientPublicIds,
				messageId: event.messagePublicId,
				timestamp: event.timestamp.toISOString(),
			})
		);
	}
}
