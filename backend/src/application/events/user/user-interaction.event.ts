import { IEvent } from "../../common/interfaces/event.interface";

export class UserInteractedWithPostEvent implements IEvent {
	readonly type = "UserInteractedWithPostEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly userId: string,
		public readonly interactionType: "like" | "unlike" | "comment" | "comment_deleted",
		public readonly postId: string,
		public readonly tags: string[],
		public readonly postOwnerId: string
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

export class UserUsernameChangedEvent implements IEvent {
	readonly type = "UserUsernameChangedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly userPublicId: string,
		public readonly oldUsername: string,
		public readonly newUsername: string
	) {}
}

export class UserCoverChangedEvent implements IEvent {
	readonly type = "UserCoverChangedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly userPublicId: string,
		public readonly oldCoverUrl?: string,
		public readonly newCoverUrl?: string
	) {}
}

export class UserDeletedEvent implements IEvent {
	readonly type = "UserDeletedEvent";
	readonly timestamp: Date = new Date();

	constructor(
		public readonly userPublicId: string,
		public readonly userId: string,
		public readonly followerPublicIds: string[]
	) {}
}
