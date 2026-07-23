import { randomUUID } from "node:crypto";
import { inject, injectable } from "tsyringe";
import { TOKENS } from "@/types/tokens";
import { OutboxRepository } from "@/repositories/outbox.repository";
import { EventBus } from "@/application/common/buses/event.bus";
import { MetricsService } from "@/metrics/metrics.service";
import { logger } from "@/utils/winston";
import { BasePollingWorker } from "@/workers/base/BasePollingWorker";
import {
  addRequestContextBreadcrumb,
  attachErrorBreadcrumbSnapshot,
  getRequestContext,
  runWithRequestContext,
} from "@/runtime/request-context";

@injectable()
export class OutboxWorker extends BasePollingWorker {
  private readonly workerId = randomUUID();

  constructor(
    @inject(TOKENS.Repositories.Outbox)
    private readonly outboxRepository: OutboxRepository,
    @inject(TOKENS.CQRS.Handlers.EventBus) private readonly eventBus: EventBus,
    @inject(TOKENS.Services.Metrics)
    private readonly metricsService: MetricsService,
  ) {
    super("OutboxWorker", 2000);
  }

  protected async tick(): Promise<void> {
    const limit = 50;
    const staleClaimMs = parseInt(
      process.env.OUTBOX_CLAIM_TIMEOUT_MS || "60000",
      10,
    );
    const pendingCount = await this.outboxRepository.countPendingEvents();
    this.metricsService.setOutboxPendingCount(pendingCount);

    if (pendingCount === 0) return;

    const events = await this.outboxRepository.claimPendingEvents(
      limit,
      this.workerId,
      staleClaimMs,
    );

    if (events.length === 0) return;

    this.metricsService.recordOutboxBatchSize(events.length);
    logger.info("Outbox events claimed", {
      event: "outbox.batch.claimed",
      worker: "OutboxWorker",
      batchSize: events.length,
      pendingCount,
      workerId: this.workerId,
    });

    for (const record of events) {
      const attemptStartedAt = Date.now();
      const eventId = String(record._id);
      const traceId = record.traceId || eventId;
      const correlationId = record.correlationId || traceId;
      const processedHandlers = new Set(record.processedHandlers || []);
      const handlers = this.eventBus.getRegisteredHandlers(record.eventType);
      const result = await runWithRequestContext(
          {
            correlationId,
            requestStartTime: process.hrtime.bigint(),
          },
          async () => {
          addRequestContextBreadcrumb("worker.outbox.received", {
            eventId,
            eventType: record.eventType,
            retryAttempt: record.retries,
          });
          let handlerInProgress = false;
          try {
            for (const handler of handlers) {
              if (processedHandlers.has(handler.key)) {
                continue;
              }

              addRequestContextBreadcrumb("worker.outbox.handler.enter", {
                eventId,
                handler: handler.key,
              });
              handlerInProgress = true;
              await handler.handle(record.payload);
              handlerInProgress = false;
              const handlerMarked =
                await this.outboxRepository.markHandlerProcessed(
                  eventId,
                  handler.key,
                  this.workerId,
                );
              if (!handlerMarked) {
                throw new Error(
                  "Outbox event ownership lost before handler checkpoint",
                );
              }
              addRequestContextBreadcrumb("worker.outbox.handler.acknowledged", {
                eventId,
                handler: handler.key,
              });
              processedHandlers.add(handler.key);
            }

            const eventMarked = await this.outboxRepository.markAsProcessed(
              eventId,
              this.workerId,
            );
            if (!eventMarked) {
              throw new Error("Outbox event ownership lost before completion");
            }
            addRequestContextBreadcrumb("worker.outbox.acknowledged", { eventId });
            return { processed: true };
          } catch (error) {
            addRequestContextBreadcrumb(
              handlerInProgress
                ? "worker.outbox.handler.failed"
                : "worker.outbox.processing.failed",
              {
              eventId,
              eventType: record.eventType,
              retryAttempt: record.retries,
              },
            );
            const message = error instanceof Error ? error.message : String(error);
            this.metricsService.recordOutboxAttempt(
              record.eventType,
              "failed",
              Date.now() - attemptStartedAt,
            );
            addRequestContextBreadcrumb("worker.outbox.retry.requested", {
              eventId,
              retryAttempt: record.retries + 1,
            });
            let failedMarked: boolean;
            try {
              failedMarked = await this.outboxRepository.markAsFailed(
                eventId,
                message,
                this.workerId,
              );
            } catch (markFailure) {
              throw attachErrorBreadcrumbSnapshot(new AggregateError(
                [error, markFailure],
                "Outbox event failure could not be recorded",
                { cause: error },
              ), getRequestContext()?.breadcrumbs ?? []);
            }
            if (failedMarked) {
              addRequestContextBreadcrumb("worker.outbox.retry.scheduled", {
                eventId,
                retryAttempt: record.retries + 1,
              });
            }
            logger.error("Outbox event failed", {
              event: "outbox.event.failed",
              worker: "OutboxWorker",
              error,
              eventId,
              eventType: record.eventType,
              retries: record.retries,
              traceId,
              correlationId,
              durationMs: Date.now() - attemptStartedAt,
              breadcrumbs: getRequestContext()?.breadcrumbs,
            });
            if (!failedMarked) {
              logger.warn("Outbox event failure not recorded because ownership changed", {
                event: "outbox.event.ownership_lost",
                worker: "OutboxWorker",
                eventId,
                eventType: record.eventType,
                traceId,
                correlationId,
              });
            }
            return { processed: false };
          }
          },
        );
      if (result.processed) {
        this.metricsService.recordOutboxAttempt(
          record.eventType,
          "processed",
          Date.now() - attemptStartedAt,
        );
        logger.info("Outbox event processed", {
          event: "outbox.event.processed",
          worker: "OutboxWorker",
          eventId,
          eventType: record.eventType,
          retries: record.retries,
          traceId,
          correlationId,
          durationMs: Date.now() - attemptStartedAt,
        });
      }
    }

    this.metricsService.setOutboxPendingCount(
      await this.outboxRepository.countPendingEvents(),
    );
  }
}
