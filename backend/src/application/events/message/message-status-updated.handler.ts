import { inject, injectable } from "tsyringe";
import { IEventHandler } from "@/application/common/interfaces/event-handler.interface";
import { MessageStatusUpdatedEvent } from "@/application/events/message/message.event";
import { RedisService } from "@/services/redis.service";
import { TOKENS } from "@/types/tokens";

@injectable()
export class MessageStatusUpdatedHandler implements IEventHandler<MessageStatusUpdatedEvent> {
	constructor(@inject(TOKENS.Services.Redis) private readonly redisService: RedisService) {}

	async handle(event: MessageStatusUpdatedEvent): Promise<void> {
		await this.redisService.publish(
			"messaging_updates",
			JSON.stringify({
				type: "message_status_updated",
				conversationId: event.conversationPublicId,
				recipients: event.participantPublicIds,
				status: event.status,
				timestamp: event.timestamp.toISOString(),
			}),
		);
	}
}
