import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/types/tokens";
import { OutboxRepository } from "@/repositories/outbox.repository";
import { EventBus } from "@/application/common/buses/event.bus";
import { logger } from "@/utils/winston";

@injectable()
export class OutboxWorker {
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs = 2000; // poll every 2 seconds

  constructor(
    @inject(TOKENS.Repositories.Outbox) private readonly outboxRepository: OutboxRepository,
    @inject(TOKENS.CQRS.Handlers.EventBus) private readonly eventBus: EventBus
  ) {}

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info("[OutboxWorker] Starting background worker");
    this.poll();
  }

  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("[OutboxWorker] Stopped background worker");
  }

  private async poll() {
    if (!this.isRunning) return;

    try {
      await this.processOutbox();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`[OutboxWorker] Error during poll: ${message}`);
    } finally {
      if (this.isRunning) {
        this.timer = setTimeout(() => this.poll(), this.pollIntervalMs);
      }
    }
  }

  private async processOutbox() {
    const limit = 50; // batch size
    const events = await this.outboxRepository.getUnprocessedEvents(limit);

    if (events.length === 0) return;

    logger.debug(`[OutboxWorker] Found ${events.length} unprocessed events`);

    for (const record of events) {
      try {
        // We dispatch using the generic publishByType method
        await this.eventBus.publishByType(record.eventType, record.payload);

        // Mark as processed
        await this.outboxRepository.markAsProcessed(String(record._id));
        logger.debug(`[OutboxWorker] Successfully processed event: ${record.eventType}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(
          `[OutboxWorker] Failed to process event ${record.eventType}: ${message}`,
        );
        await this.outboxRepository.markAsFailed(String(record._id), message);
      }
    }
  }
}
