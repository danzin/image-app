import { IEvent } from "../../common/interfaces/event.interface";

/**
 * Fired when a new post is created
 */
export class PostUploadedEvent implements IEvent {
	readonly type = "PostUploadedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly postId: string,
		public readonly authorPublicId: string,
		public readonly tags: string[]
	) {}
}

/**
 * Fired when a post is deleted
 */
export class PostDeletedEvent implements IEvent {
	readonly type = "PostDeletedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly postId: string,
		public readonly authorPublicId: string
	) {}
}
