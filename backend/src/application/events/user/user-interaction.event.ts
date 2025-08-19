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

/**
 * Fired when a new image is uploaded
 * This is separate from interaction events because it affects different users
 */
export class ImageUploadedEvent implements IEvent {
	readonly type = "ImageUploadedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly imageId: string,
		public readonly uploaderPublicId: string,
		public readonly tags: string[]
	) {}
}

/**
 * Fired when an image is deleted
 */
export class ImageDeletedEvent implements IEvent {
	readonly type = "ImageDeletedEvent";
	readonly timestamp: Date = new Date();

	constructor(public readonly imageId: string, public readonly uploaderPublicId: string) {}
}
