import { IEvent } from "../common/interfaces/event.interface";

export class ColdStartFeedGeneratedEvent implements IEvent {
  readonly type = "ColdStartFeedGenerated";
  readonly timestamp: Date = new Date();

  constructor(public readonly userId: string) {}
}
