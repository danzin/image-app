import { IEvent } from "@/application/common/interfaces/event.interface";

export class MessageSentEvent implements IEvent {
	readonly type = "MessageSentEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly conversationPublicId: string,
		public readonly senderPublicId: string,
		public readonly recipientPublicIds: string[],
		public readonly messagePublicId: string
	) {}
}
