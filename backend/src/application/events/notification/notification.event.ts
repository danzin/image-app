import { UserPublicId, PostPublicId, ImagePublicId, MongoId } from "@/types/branded";
import { IEvent } from "@/application/common/interfaces/event.interface";
import { EventRegistry } from "@/application/common/events/event-registry";

export interface NotificationPayload {
	receiverId: UserPublicId;
	actionType: string;
	actorId: UserPublicId;
	actorUsername?: string;
	actorHandle?: string;
	actorAvatar?: string;
	targetId?: PostPublicId | ImagePublicId | UserPublicId | MongoId;
	targetType?: string;
	targetPreview?: string;
	idempotencyKey?: string;
}

export class NotificationRequestedEvent implements IEvent {
	static readonly type = EventRegistry.domain.NotificationRequested;
	readonly type = NotificationRequestedEvent.type;
	readonly timestamp: Date = new Date();

	constructor(public readonly payload: NotificationPayload) {}
}
