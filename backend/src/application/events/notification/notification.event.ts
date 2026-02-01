import { IEvent } from "@/application/common/interfaces/event.interface";

export interface NotificationPayload {
	receiverId: string;
	actionType: string;
	actorId: string;
	actorUsername?: string;
	actorAvatar?: string;
	targetId?: string;
	targetType?: string;
	targetPreview?: string;
}

export class NotificationRequestedEvent implements IEvent {
	readonly type = "NotificationRequestedEvent";
	readonly timestamp: Date = new Date();

	constructor(public readonly payload: NotificationPayload) {}
}
