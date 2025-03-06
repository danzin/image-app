import { injectable } from "tsyringe";
import { IEventHandler } from "../interfaces/event-handler.interface";
import { IEvent } from "../interfaces/event.interface";

@injectable()
export class EventBus {
  private subscriptions: Map<string, IEventHandler<IEvent>[]> = new Map();
  private transactionalQueue: Array<{event: IEvent, handler: IEventHandler<IEvent>}> = [];

  // Subscribe to an event typr
  subscribe<TEvent extends IEvent>(
    eventType: { new(...args: any[]): TEvent},
    handler: IEventHandler<TEvent>
  ): void {
    const eventName = eventType.name;
    const handlers = this.subscriptions.get(eventName) || [];
    handlers.push(handler as IEventHandler<IEvent>);
    this.subscriptions.set(eventName, handlers);
  }

  // Immediately publish
  async publish<TEvent extends IEvent>(event: TEvent): Promise<void>{
    const handlers = this.subscriptions.get(event.constructor.name) || [];

    await Promise.all(handlers.map(handler => handler.handle(event)))
  }

  // For transactions
  queueTransactional<TEvent extends IEvent>(event: TEvent, handler: IEventHandler<TEvent>): void {
    this.transactionalQueue.push({
      event, 
      handler: handler as IEventHandler<TEvent>
    });
  }

  // Flush transactionalQueue after transaction commit 
  async flushTransactionalQueue(): Promise<void> {
    await Promise.all(this.transactionalQueue.map(({event, handler}) => {
      handler.handle(event).catch(err => {
        console.error(`Transactional event ffailed: ${err.message}`);
      })
    }));
    this.transactionalQueue = [];
  }  

  // Clear transaction queue
  clearTransactionalQueue() : void {
    this.transactionalQueue = [];
  }

} 

