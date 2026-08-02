import { UserPublicId } from "@/types/branded";
import { IEvent } from "@/application/common/interfaces/event.interface";
import { EventRegistry } from "@/application/common/events/event-registry";

// Event triggered when a cold start feed is generated for a user
export class ColdStartFeedGeneratedEvent implements IEvent {
  static readonly type = EventRegistry.domain.ColdStartFeedGenerated;
  readonly type = ColdStartFeedGeneratedEvent.type;
  readonly timestamp: Date = new Date();

  constructor(public readonly userId: UserPublicId) {}
}
