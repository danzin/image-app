import { injectable } from "tsyringe";
import { IEventHandler } from "../interfaces/event-handler.interface";
import { IEvent } from "../interfaces/event.interface";

@injectable()
export class EventBus {
  private subscriptions: Map<string, IEventHandler<IEvent>[]> = new Map();

  // A queue to temporarily store events for transactional execution
  private transactionalQueue: Array<{
    event: IEvent;
    handler: IEventHandler<IEvent>;
  }> = [];

  /**
   * Subscribes a handler to a specific event type.
   * @param eventType - The class constructor of the event type.
   * @param handler - The handler responsible for processing the event.
   */
  subscribe<TEvent extends IEvent>(
    eventType: { new (...args: any[]): TEvent },
    handler: IEventHandler<TEvent>
  ): void {
    const eventName = eventType.name;
    const handlers = this.subscriptions.get(eventName) || [];
    handlers.push(handler as IEventHandler<IEvent>);
    this.subscriptions.set(eventName, handlers);
  }

  /**
   * Publishes an event immediately, executing all subscribed handlers.
   * @param event - The event instance to be published.
   */
  async publish<TEvent extends IEvent>(event: TEvent): Promise<void> {
    const handlers = this.subscriptions.get(event.constructor.name) || [];

    await Promise.all(handlers.map((handler) => handler.handle(event)));
  }

  /**
   * Queues an event for transactional execution. The event will be processed later.
   * @param event - The event to be queued.
   * @param handler - The handler responsible for processing the event.
   */
  queueTransactional<TEvent extends IEvent>(
    event: TEvent,
    handler: IEventHandler<TEvent>
  ): void {
    this.transactionalQueue.push({
      event,
      handler: handler as IEventHandler<TEvent>,
    });
  }

  /**
   * Flushes the transactional queue, executing all queued events.
   * If a handler fails, it logs the error but continues processing other events.
   */
  async flushTransactionalQueue(): Promise<void> {
    await Promise.all(
      this.transactionalQueue.map(({ event, handler }) => {
        handler.handle(event).catch((err) => {
          console.error(`Transactional event ffailed: ${err.message}`);
        });
      })
    );
    this.transactionalQueue = [];
  }

  /**
   * Clears all events from the transactional queue without executing them.
   */
  clearTransactionalQueue(): void {
    this.transactionalQueue = [];
  }
}
