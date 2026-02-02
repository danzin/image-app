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

export class MessageStatusUpdatedEvent implements IEvent {
	readonly type = "MessageStatusUpdatedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly conversationPublicId: string,
		public readonly participantPublicIds: string[],
		public readonly status: "delivered" | "read",
	) {}
}
