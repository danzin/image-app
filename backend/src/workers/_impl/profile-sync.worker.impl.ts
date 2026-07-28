import { UserPublicId, asUserPublicId } from "@/types/branded";
import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";
import { RedisService } from "@/services/redis.service";
import type {
  IPostWriteRepository,
  IUserReadRepository,
} from "@/repositories/interfaces";
import { logger } from "@/utils/winston";
import { TOKENS } from "@/types/tokens";
import { EventRegistry } from "@/application/common/events/event-registry";
import {
  addRequestContextBreadcrumb,
  getRequestContext,
  runWithRequestContext,
} from "@/runtime/request-context";
import { logNonHttpTerminalError } from "@/runtime/non-http-error-logger";
import { randomUUID } from "node:crypto";
import {
  ClientClosedError,
  DisconnectsClientError,
} from "@redis/client/dist/lib/errors";

interface ProfileSnapshotMessage {
  type:
    | typeof EventRegistry.realtimeMessageTypes.avatarChanged
    | typeof EventRegistry.socketPayloadTypes.usernameChanged;
  userPublicId: UserPublicId;
  avatarUrl?: string;
  username?: string;
  handle?: string;
  timestamp: string;
}

type PendingProfileUpdate = {
  avatarUrl?: string;
  username?: string;
  handle?: string;
  lastSeen: number;
};

/**
 * @class ProfileSyncWorker
 * Background worker responsible for propagating user profile changes (Avatar, Username)
 * to historical content.
 *
 * @architecture Eventual Consistency / Fan-out on Read
 * @problem Changing an avatar requires updating potentially thousands of old posts.
 * Doing this synchronously in the request handler would cause high latency.
 * @solution This worker listens for change events and performs bulk updates in the background.
 * It effectively decouples the "User Write" from the "System Consistency" overhead.
 */
@injectable()
export class ProfileSyncWorker {
  private running = false;
  private stopping = false;
  private flushing = false;

  // debounce multiple rapid changes from same user
  private pendingUpdates = new Map<string, PendingProfileUpdate>();
  private flushTimer?: NodeJS.Timeout;
  private FLUSH_INTERVAL_MS = 2000; // batch updates every 2 seconds
  private inFlightCallbacks = new Set<Promise<void>>();

  constructor(
    @inject(TOKENS.Services.Redis)
    private readonly redisService: RedisService,
    @inject(TOKENS.Repositories.PostWrite)
    private readonly postWriteRepository: IPostWriteRepository,
    @inject(TOKENS.Repositories.UserRead)
    private readonly userReadRepository: IUserReadRepository,
  ) {}

  async start(): Promise<void> {
    if (this.running) return;
    this.stopping = false;

    const operationId = randomUUID();
    await runWithRequestContext(
      { correlationId: operationId, requestStartTime: process.hrtime.bigint() },
      async () => {
        addRequestContextBreadcrumb("worker.profile_sync.startup.started", {
          worker: "ProfileSyncWorker",
        });
        const subscribed =
          await this.redisService.subscribe<ProfileSnapshotMessage>(
            [EventRegistry.redisChannels.profileSnapshotUpdates],
            (_channel, message) => {
              this.trackBackgroundRoot("handle_message", () =>
                this.handleMessage(message),
              );
            },
            { timeoutMs: 1500 },
          );

        if (!subscribed) {
          logger.warn(
            "[profile-sync] worker not started because Redis is unavailable",
          );
          return;
        }

        this.running = true;

        this.flushTimer = setInterval(() => {
          this.trackBackgroundRoot("flush_pending_updates", () =>
            this.flushPendingUpdates(),
          );
        }, this.FLUSH_INTERVAL_MS);

        addRequestContextBreadcrumb("worker.profile_sync.startup.completed", {
          worker: "ProfileSyncWorker",
        });
        logger.info(
          "[profile-sync] worker started, listening on profile_snapshot_updates channel",
        );
      },
    );
  }

  async stop(): Promise<void> {
    const operationId = randomUUID();
    await runWithRequestContext(
      { correlationId: operationId, requestStartTime: process.hrtime.bigint() },
      async () => {
        addRequestContextBreadcrumb("worker.profile_sync.shutdown.started", {
          worker: "ProfileSyncWorker",
        });
        this.stopping = true;
        this.running = false;
        if (this.flushTimer) {
          clearInterval(this.flushTimer);
        }
        await Promise.allSettled(this.inFlightCallbacks);
        await this.flushPendingUpdates();
        addRequestContextBreadcrumb("worker.profile_sync.shutdown.completed", {
          worker: "ProfileSyncWorker",
        });
        logger.info("[profile-sync] worker stopped");
      },
    );
  }

  /**
   * Handles incoming profile change events with In-Memory Debouncing.
   *
   * @pattern Debounce / Coalescing
   * @why If a user updates their profile 5 times in 1 second it shouldn't run
   * 5 heavy database updates. Store the latest state in a Map and
   * only flush to MongoDB once per interval.
   *
   * @param message - The raw Pub/Sub message containing the userPublicId and changed fields.
   * @returns {Promise<void>}
   */
  private async handleMessage(message: ProfileSnapshotMessage): Promise<void> {
    if (this.stopping) {
      return;
    }
    const { type, userPublicId, avatarUrl, username, handle } = message;

    logger.info("Profile sync message received", {
      event: "worker.profile_sync.message.received",
      messageType: type,
    });

    // coalesce updates for same user
    const existing = this.pendingUpdates.get(userPublicId) ?? {
      lastSeen: Date.now(),
    };

    if (
      type === EventRegistry.realtimeMessageTypes.avatarChanged &&
      avatarUrl !== undefined
    ) {
      existing.avatarUrl = avatarUrl;
    }
    if (
      type === EventRegistry.socketPayloadTypes.usernameChanged &&
      username !== undefined
    ) {
      existing.username = username;
    }
    if (handle !== undefined) {
      existing.handle = handle;
    }
    existing.lastSeen = Date.now();

    this.pendingUpdates.set(userPublicId, existing);
  }

  /**
   * Executes the bulk update against MongoDB.
   *
   * @optimization Batch Processing
   * @strategy Flushes all pending updates in one loop to minimize database connection
   * overhead and index thrashing.
   *
   * @returns {Promise<void>} Resolves when the batch update is complete.
   */
  private async flushPendingUpdates(): Promise<void> {
    if (this.flushing || this.pendingUpdates.size === 0) return;

    this.flushing = true;
    const entries = Array.from(this.pendingUpdates.entries());
    this.pendingUpdates.clear();

    try {
      logger.info(
        `[profile-sync] flushing ${entries.length} pending profile updates`,
      );

      for (const [userPublicId, updates] of entries) {
        let user: Awaited<ReturnType<IUserReadRepository["findByPublicId"]>>;
        try {
          user = await this.userReadRepository.findByPublicId(
            asUserPublicId(userPublicId),
          );
        } catch (error) {
          this.requeuePendingUpdate(userPublicId, updates);
          logger.warn("[profile-sync] failed to read user for snapshot update", {
            error,
          });
          continue;
        }

        if (!user) {
          logger.warn("Profile sync user not found", {
            event: "worker.profile_sync.user.not_found",
          });
          continue;
        }

        const userObjectId = new mongoose.Types.ObjectId(user.id);
        const snapshotUpdates: Omit<PendingProfileUpdate, "lastSeen"> = {};

        if (updates.avatarUrl !== undefined) {
          snapshotUpdates.avatarUrl = updates.avatarUrl;
        }
        if (updates.username !== undefined) {
          snapshotUpdates.username = updates.username;
        }
        if (updates.handle !== undefined) {
          snapshotUpdates.handle = updates.handle;
        }

        if (Object.keys(snapshotUpdates).length === 0) {
          continue;
        }

        let modifiedCount: number;
        try {
          modifiedCount = await this.postWriteRepository.updateAuthorSnapshot(
            userObjectId,
            snapshotUpdates,
          );
        } catch (error) {
          this.requeuePendingUpdate(userPublicId, updates);
          logger.warn("[profile-sync] failed to update author snapshot", {
            error,
          });
          continue;
        }

        logger.info(
          `[profile-sync] updated ${modifiedCount} posts for user ${userPublicId}:`,
          {
            updates: snapshotUpdates,
          },
        );
      }
    } catch (error) {
      for (const [userPublicId, updates] of entries) {
        this.requeuePendingUpdate(userPublicId, updates);
      }
      throw error;
    } finally {
      this.flushing = false;
    }
  }

  private requeuePendingUpdate(
    userPublicId: string,
    failedUpdate: PendingProfileUpdate,
  ): void {
    const pendingUpdate = this.pendingUpdates.get(userPublicId);
    if (!pendingUpdate) {
      this.pendingUpdates.set(userPublicId, { ...failedUpdate });
      return;
    }

    const newer =
      pendingUpdate.lastSeen >= failedUpdate.lastSeen
        ? pendingUpdate
        : failedUpdate;
    const older = newer === pendingUpdate ? failedUpdate : pendingUpdate;
    this.pendingUpdates.set(userPublicId, {
      lastSeen: Math.max(pendingUpdate.lastSeen, failedUpdate.lastSeen),
      avatarUrl: newer.avatarUrl ?? older.avatarUrl,
      username: newer.username ?? older.username,
      handle: newer.handle ?? older.handle,
    });
  }

  private async runBackgroundRoot(
    operation: string,
    work: () => Promise<void>,
  ): Promise<void> {
    if (this.stopping) {
      return;
    }

    const operationId = randomUUID();
    await runWithRequestContext(
      { correlationId: operationId, requestStartTime: process.hrtime.bigint() },
      async () => {
        addRequestContextBreadcrumb("worker.profile_sync.callback.started", {
          worker: "ProfileSyncWorker",
          operation,
        });
        try {
          await work();
          addRequestContextBreadcrumb("worker.profile_sync.callback.completed", {
            worker: "ProfileSyncWorker",
            operation,
          });
        } catch (error) {
          if (
            this.stopping &&
            isExpectedRedisClientShutdownError(error)
          ) {
            return;
          }
          addRequestContextBreadcrumb("worker.profile_sync.callback.failed", {
            worker: "ProfileSyncWorker",
            operation,
          });
          logNonHttpTerminalError(error, {
            message: "Profile sync worker background callback failed",
            event: "worker.profile_sync.callback.failed",
            operation: `worker.profile_sync.${operation}`,
            operationId,
            worker: "ProfileSyncWorker",
            breadcrumbs: getRequestContext()?.breadcrumbs,
          });
        }
      },
    );
  }

  private trackBackgroundRoot(
    operation: string,
    work: () => Promise<void>,
  ): void {
    const callback = this.runBackgroundRoot(operation, work);
    this.inFlightCallbacks.add(callback);
    void callback.then(
      () => this.inFlightCallbacks.delete(callback),
      () => this.inFlightCallbacks.delete(callback),
    );
  }
}

function isExpectedRedisClientShutdownError(error: unknown): boolean {
  return (
    error instanceof ClientClosedError || error instanceof DisconnectsClientError
  );
}
