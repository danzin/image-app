import { IEvent } from "../../../application/common/interfaces/event.interface";

export class UserInteractedWithImageEvent implements IEvent {
  readonly type = 'UserInteractedWithImageEvent';
  readonly timestamp: Date = new Date();

  constructor(
    public readonly userId: string,       // ID of user performing action
    public readonly interactionType: 'like' | 'unlike', // Action type
    public readonly imageId: string,      // ID of affected image
    public readonly tags: string[],       // Image tags for feed processing
    public readonly imageOwnerId?: string // Optional: for notifications
  ) {}
}