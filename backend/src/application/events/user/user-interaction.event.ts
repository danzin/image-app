import { IEvent } from "../../../application/common/interfaces/event.interface";

export class UserInteractedWithImageEvent implements IEvent {
	readonly type = "UserInteractedWithImageEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly userId: string,
		public readonly interactionType: "like" | "unlike" | "comment" | "comment_deleted",
		public readonly imageId: string,
		public readonly tags: string[],
		public readonly imageOwnerId: string
	) {}
}

export class UserAvatarChangedEvent implements IEvent {
	readonly type = "UserAvatarChangedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly userPublicId: string, // Use publicId, not ObjectId
		public readonly oldAvatarUrl?: string,
		public readonly newAvatarUrl?: string
	) {}
}
