import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import { performance } from "perf_hooks";
import type { RedisClientType } from "redis";
import { RedisService } from "@/services/redis.service";
import { asPostPublicId } from "@/types/branded";
import type { IPostReadRepository } from "@/repositories/interfaces";
import { FeedPost } from "@/types";
import { logger } from "@/utils/winston";
import {
  addRequestContextBreadcrumb,
  getRequestContext,
  runWithRequestContext,
} from "@/runtime/request-context";
import { logNonHttpTerminalError } from "@/runtime/non-http-error-logger";
import { randomUUID } from "node:crypto";
import {
  ClientOfflineError,
  ClientClosedError,
  ConnectionTimeoutError,
  DisconnectsClientError,
  ReconnectStrategyError,
  RootNodesUnavailableError,
  SocketClosedUnexpectedlyError,
} from "@redis/client/dist/lib/errors";
import type { IFeedReadDao } from "@/repositories/interfaces";
import { TOKENS } from "@/types/tokens";
import type {
  XPendingRangeEntry,
  XClaimEntry,
  XClaimReply,
} from "@/services/redis/redis-stream.module";

/** Handles trending feed updates and calculations
 * This worker uses a classic write-behind cache pattern. It runs the expensive mongo aggregation once
 * and updates the top 500(can be adjusted) posts in Redis sorted set
 * Stores post metadata in Redis cache
 * massively reducing database load and providing faster API responses for trending feed.
 * TRENDING_BATCH_MS=2000           # How often to process stream events (2s)
 * TRENDING_FULL_REFRESH_MS=300000  # How often to refresh all posts (5min)
 * TRENDING_READ_COUNT=100          # Stream batch size
 *
 * It periodically refreshes the trending feed while pre-computing everything in the background
 * allowing for the API to serve cached results with real-time updates via Redis Streams.
 *
 * It also falls back to Mongo if Redis is empty (graceful degradation)
 *
 * The point of this thing is to allow handling a high volume of concurrent users.
 * It can be replicated for other feeds.
 */

type PendingDeltas = {
  commentsDelta: number;
  likesDelta: number;
  lastSeen: number;
  messageIds: string[];
};

type TrendingScore = {
  ageDays: number;
  comments: number;
  commentsScore: number;
  likes: number;
  popularityScore: number;
  recencyScore: number;
  score: number;
  views: number;
};

type TrendingCacheUpdate = {
  comments: number;
  likes: number;
  postId: string;
  score: number;
  views: number;
};

@injectable()
export class TrendingWorker {
  private STREAM = "stream:interactions";
  private GROUP = "trendingGroup";
  private CONSUMER = `trending-${process.env.HOSTNAME ?? "local"}-${process.pid}`;
  private BATCH_WINDOW_MS = Number(process.env.TRENDING_BATCH_MS) || 2000; // calc and update trend scores every 2 secs
  private READ_COUNT = Number(process.env.TRENDING_READ_COUNT) || 100;
  private RECLAIM_MIN_IDLE_MS =
    Number(process.env.TRENDING_RECLAIM_MS) || 60_000;
  private RECLAIM_INTERVAL_MS =
    Number(process.env.TRENDING_RECLAIM_INTERVAL_MS) || 30_000;
  private CHUNK_SIZE = 50;
  private FULL_REFRESH_INTERVAL_MS =
    Number(process.env.TRENDING_FULL_REFRESH_MS) || 300_000; // full refresh every 5 min
  private REDIS_STARTUP_TIMEOUT_MS = 5000;

  private WEIGHTS = { recency: 0.4, popularity: 0.5, comments: 0.1 };

  private redisClient: RedisClientType | null = null; // dedicated client for blocking xReadGroup use

  private pending = new Map<string, PendingDeltas>();
  private flushing = false;
  private running = false;
  private stopping = false;
  private flushTimer?: NodeJS.Timeout;
  private reclaimTimer?: NodeJS.Timeout;
  private fullRefreshTimer?: NodeJS.Timeout;
  private inFlightCallbacks = new Set<Promise<void>>();

  constructor(
    @inject(TOKENS.Repositories.FeedReadDao)
    private readonly feedReadDao: IFeedReadDao,
    @inject(TOKENS.Services.Redis)
    private readonly redisService: RedisService,
    @inject(TOKENS.Repositories.PostRead)
    private readonly postReadRepository: IPostReadRepository,
  ) {}

  /** initialize dependencies and create consumer group if necessary */
  async init(): Promise<void> {
    const operationId = randomUUID();
    await runWithRequestContext(
      { correlationId: operationId, requestStartTime: process.hrtime.bigint() },
      async () => {
        addRequestContextBreadcrumb("worker.trending.startup.started", {
          worker: "TrendingWorker",
        });
        const connected = await this.redisService.waitForConnection(
          this.REDIS_STARTUP_TIMEOUT_MS,
        );
        if (!connected) {
          throw new Error("Redis unavailable; trending worker cannot start");
        }

        await this.redisService.createStreamConsumerGroup(this.STREAM, this.GROUP);
        this.redisClient = await this.redisService.createDedicatedClient();
        addRequestContextBreadcrumb("worker.trending.startup.completed", {
          worker: "TrendingWorker",
        });
        logger.info(
          `[trending] ensured consumer group ${this.GROUP} on ${this.STREAM}`,
        );
      },
    );
  }

  /** start reading stream and flushing batches */
  start(): void {
    if (this.running) return;
    this.stopping = false;
    this.running = true;

    void this.readLoop().catch((error) =>
      this.runBackgroundRoot("read_loop", async () => {
        throw error;
      }),
    );

    this.flushTimer = setInterval(() => {
      this.trackBackgroundRoot("flush_pending", () => this.flushPending());
    }, this.BATCH_WINDOW_MS);

    this.reclaimTimer = setInterval(() => {
      this.trackBackgroundRoot("reclaim_stalled_messages", () =>
        this.reclaimStalledMessages(),
      );
    }, this.RECLAIM_INTERVAL_MS);

    // periodically refresh entire trending feed to catch posts without recent interactions
    this.fullRefreshTimer = setInterval(() => {
      this.trackBackgroundRoot("full_refresh", () => this.fullRefresh());
    }, this.FULL_REFRESH_INTERVAL_MS);

    // run initial full refresh on startup
    this.trackBackgroundRoot("initial_full_refresh", () => this.fullRefresh());

    logger.info(`[trending] worker started (consumer=${this.CONSUMER})`);
  }

  /** stop reading and gracefully shutdown (flush pending) */
  async stop(): Promise<void> {
    const operationId = randomUUID();
    await runWithRequestContext(
      { correlationId: operationId, requestStartTime: process.hrtime.bigint() },
      async () => {
        addRequestContextBreadcrumb("worker.trending.shutdown.started", {
          worker: "TrendingWorker",
        });
        this.stopping = true;
        this.running = false;
        if (this.flushTimer) clearInterval(this.flushTimer);
        if (this.reclaimTimer) clearInterval(this.reclaimTimer);
        if (this.fullRefreshTimer) clearInterval(this.fullRefreshTimer);

        await Promise.allSettled(this.inFlightCallbacks);
        await this.flushPending();
        if (this.redisClient?.isOpen) {
          await this.redisClient.quit();
        }
        this.redisClient = null;
        addRequestContextBreadcrumb("worker.trending.shutdown.completed", {
          worker: "TrendingWorker",
        });
        logger.info("[trending] worker stopped");
      },
    );
  }

  /** main read loop that consumes stream messages using XREADGROUP via clientInstance */
  private async readLoop(): Promise<void> {
    while (this.running && this.redisClient) {
      await this.runBackgroundRoot("read_loop_iteration", () =>
        this.readLoopIteration(),
      );
    }
  }

  private async readLoopIteration(): Promise<void> {
    const redisClient = this.redisClient;
    if (!redisClient) {
      throw new Error("Trending Redis client is not initialized");
    }

    let responses: unknown;
    try {
      responses = await redisClient.xReadGroup(
        this.GROUP,
        this.CONSUMER,
        { key: this.STREAM, id: ">" },
        { COUNT: this.READ_COUNT, BLOCK: 5_000 },
      );
    } catch (err) {
      if (this.stopping && isExpectedRedisClientShutdownError(err)) {
        return;
      }
      if (!isRetryableRedisTransportError(err)) {
        throw err;
      }
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn("[trending] readLoop error", {
        message: errorMessage,
        error: err,
      });
      await this.sleep(1000);
      return;
    }

    if (responses === null) {
      return;
    }
    if (!Array.isArray(responses)) {
      throw new TypeError("Malformed Redis stream response");
    }

    for (const streamRes of responses) {
      if (!isRecord(streamRes) || !Array.isArray(streamRes.messages)) {
        throw new TypeError("Malformed Redis stream response");
      }
      for (const message of streamRes.messages) {
        const messageId = isRecord(message) ? message.id : undefined;
        const messageFields = isRecord(message) ? message.message : undefined;
        if (
          typeof messageId !== "string" ||
          !isStringRecord(messageFields)
        ) {
          throw new TypeError("Malformed Redis stream message");
        }
        this.trackBackgroundRoot("handle_stream_message", () =>
          this.handleStreamMessage(messageId, messageFields),
        );
      }
    }
  }

  /** handle a single stream message: coalesce it for the next flush */
  private async handleStreamMessage(
    id: string,
    fields: Record<string, string>,
  ): Promise<void> {
    if (this.stopping) {
      return;
    }
    const postId = fields.postId ?? fields.postPublicId ?? fields.post;

    if (!postId) {
      logger.warn(`[trending] malformed message ${id} missing postId - acking`);
      await this.redisService.ackStreamMessages(this.STREAM, this.GROUP, id);
      return;
    }

    const now = Date.now();
    const existing = this.pending.get(postId) ?? {
      commentsDelta: 0,
      likesDelta: 0,
      lastSeen: now,
      messageIds: [],
    };
    existing.lastSeen = now;
    if (!existing.messageIds.includes(id)) {
      existing.messageIds.push(id);
    }
    this.pending.set(postId, existing);
  }

  private requeueEntries(entries: Array<[string, PendingDeltas]>): void {
    for (const [postId, entry] of entries) {
      const existing = this.pending.get(postId);
      if (!existing) {
        this.pending.set(postId, {
          ...entry,
          messageIds: [...entry.messageIds],
        });
        continue;
      }

      existing.lastSeen = Math.max(existing.lastSeen, entry.lastSeen);
      for (const messageId of entry.messageIds) {
        if (!existing.messageIds.includes(messageId)) {
          existing.messageIds.push(messageId);
        }
      }
      this.pending.set(postId, existing);
    }
  }

  /** Flush pending map: compute score per post and update ZSET via helper */
  private async flushPending(): Promise<void> {
    if (this.flushing) return;
    if (this.pending.size === 0) return;
    this.flushing = true;
    const start = performance.now();

    try {
      const entries = Array.from(this.pending.entries());
      this.pending.clear();

      for (let i = 0; i < entries.length; i += this.CHUNK_SIZE) {
        const chunk = entries.slice(i, i + this.CHUNK_SIZE);
        const postIds = chunk.map(([postId]) => postId);
        let posts: FeedPost[];

        try {
          posts = await this.postReadRepository.findPostsByPublicIds(
            postIds.map(asPostPublicId),
          );
        } catch (error) {
          this.requeueEntries(chunk);
          logger.warn("[trending] repository read failed during flush", {
            error,
          });
          continue;
        }
        if (!Array.isArray(posts)) {
          this.requeueEntries(chunk);
          throw new TypeError("Malformed repository result during trending flush");
        }

        const cacheUpdates: TrendingCacheUpdate[] = [];
        const messageIdsToAck: string[] = [];
        try {
          const postMap = new Map<string, FeedPost>();
          for (const post of posts) {
            if (
              !isRecord(post) ||
              typeof post.publicId !== "string" ||
              post.publicId.length === 0
            ) {
              throw new TypeError(
                "Malformed repository post during trending flush",
              );
            }
            postMap.set(post.publicId, post);
          }

          for (const [postId, pendingEntry] of chunk) {
            messageIdsToAck.push(...pendingEntry.messageIds);
            const post = postMap.get(postId);
            if (!post) {
              logger.warn(
                `[trending] post ${postId} missing during flush; acknowledging pending messages`,
              );
              continue;
            }

            const {
              ageDays,
              comments,
              commentsScore,
              likes,
              popularityScore,
              recencyScore,
              score,
              views,
            } = this.calculateTrendingScore(post);

            logger.debug(
              `[trending] ${postId}: likes=${likes}, comments=${comments}, age=${ageDays.toFixed(1)}d, ` +
                `recency=${recencyScore.toFixed(3)}, popularity=${popularityScore.toFixed(3)}, score=${score.toFixed(3)}`,
            );

            cacheUpdates.push({
              comments,
              likes,
              postId,
              score,
              views,
            });
          }
        } catch (error) {
          this.requeueEntries(chunk);
          throw error;
        }

        let updates: Promise<unknown>[];
        try {
          updates = cacheUpdates.flatMap(
            ({ comments, likes, postId, score, views }) => [
              this.redisService.updateTrendingScore(
                postId,
                score,
                "trending:posts",
              ),
              this.redisService.setWithTags(
                `post_meta:${postId}`,
                {
                  likes,
                  commentsCount: comments,
                  viewsCount: views,
                  lastUpdated: Date.now(),
                },
                [
                  `post_meta:${postId}`,
                  `post_likes:${postId}`,
                  `post_comments:${postId}`,
                ],
                300,
              ),
            ],
          );
        } catch (error) {
          this.requeueEntries(chunk);
          throw error;
        }

        try {
          await Promise.all(updates);
        } catch (error) {
          this.requeueEntries(chunk);
          logger.warn("[trending] Redis cache write failed during flush", {
            error,
          });
          continue;
        }

        if (messageIdsToAck.length > 0) {
          try {
            await this.redisService.ackStreamMessages(
              this.STREAM,
              this.GROUP,
              ...messageIdsToAck,
            );
          } catch (error) {
            this.requeueEntries(chunk);
            logger.warn("[trending] stream ACK failed during flush", { error });
            continue;
          }
        }
      }
    } finally {
      this.flushing = false;
      const dur = performance.now() - start;
      logger.info(`[trending] flushed updates (${dur.toFixed(1)}ms)`);
    }
  }

  /** reclaim messages that are pending (XPENDING) and idle for > RECLAIM_MIN_IDLE_MS using helpers */
  private async reclaimStalledMessages(): Promise<void> {
    let pendingSummary: XPendingRangeEntry[];
    try {
      pendingSummary = await this.redisService.xPendingRange(
        this.STREAM,
        this.GROUP,
        "-",
        "+",
        1000,
      );
    } catch (err) {
      if (this.stopping && isExpectedRedisClientShutdownError(err)) {
        return;
      }
      if (!isRetryableRedisTransportError(err)) {
        throw err;
      }
      logger.warn("[trending] XPENDING failed; deferring reclaim", {
        error: err,
      });
      return;
    }

    if (!Array.isArray(pendingSummary)) {
      throw new TypeError("Malformed XPENDING response");
    }
    if (pendingSummary.length === 0) return;

    const toClaim: string[] = [];
    for (const item of pendingSummary) {
      if (
        !isRecord(item) ||
        typeof item.id !== "string" ||
        typeof item.millisecondsSinceLastDelivery !== "number" ||
        !Number.isFinite(item.millisecondsSinceLastDelivery)
      ) {
        throw new TypeError("Malformed XPENDING entry");
      }
      if (item.millisecondsSinceLastDelivery >= this.RECLAIM_MIN_IDLE_MS) {
        toClaim.push(item.id);
      }
    }

    if (toClaim.length === 0) return;

    let claimResult: XClaimReply;
    try {
      claimResult = await this.redisService.xClaim(
        this.STREAM,
        this.GROUP,
        this.CONSUMER,
        this.RECLAIM_MIN_IDLE_MS,
        toClaim,
      );
    } catch (err) {
      if (this.stopping && isExpectedRedisClientShutdownError(err)) {
        return;
      }
      if (!isRetryableRedisTransportError(err)) {
        throw err;
      }
      logger.warn("[trending] XCLAIM failed; deferring reclaim", { error: err });
      return;
    }

    if (!Array.isArray(claimResult)) {
      throw new TypeError("Malformed XCLAIM response");
    }
    const claimed = claimResult.filter(
      (message): message is XClaimEntry => message !== null,
    );

    for (const message of claimed) {
      const messageId = isRecord(message) ? message.id : undefined;
      const messageFields = isRecord(message) ? message.message : undefined;
      if (
        typeof messageId !== "string" ||
        !isStringRecord(messageFields)
      ) {
        throw new TypeError("Malformed XCLAIM entry");
      }
      try {
        await this.handleStreamMessage(messageId, messageFields);
      } catch (err) {
        if (this.stopping && isExpectedRedisClientShutdownError(err)) {
          return;
        }
        if (!isRetryableRedisTransportError(err)) {
          throw err;
        }
        logger.warn("[trending] reclaimed message remains pending", {
          error: err,
        });
      }
    }
  }

  /**
   * Full refresh: recalculate scores for all posts in time window
   * This ensures posts without recent interactions still get ranked
   */
  private async fullRefresh(): Promise<void> {
    logger.info("[trending] starting full refresh...");
    const start = performance.now();

    const timeWindowDays = 14;
    const limit = 500;
    let result: unknown;
    try {
      result = await this.feedReadDao.getTrendingFeedWithCursor({
        limit,
        timeWindowDays,
        minLikes: 0,
      });
    } catch (error) {
      logger.warn("[trending] full refresh DAO query failed", { error });
      return;
    }

    if (!isRecord(result) || !Array.isArray(result.data)) {
      throw new TypeError("Malformed trending full-refresh result");
    }
    if (result.data.length === 0) {
      logger.warn("[trending] no posts found for full refresh");
      return;
    }

    const cacheUpdates: TrendingCacheUpdate[] = [];

    for (const post of result.data) {
      const { comments, likes, score, views } =
        this.calculateTrendingScore(post);
      const postId = post.publicId;
      cacheUpdates.push({ comments, likes, postId, score, views });
    }

    const updates = cacheUpdates.flatMap(
      ({ comments, likes, postId, score, views }) => [
        this.redisService.updateTrendingScore(
          postId,
          score,
          "trending:posts",
        ),
        this.redisService.setWithTags(
          `post_meta:${postId}`,
          {
            likes,
            commentsCount: comments,
            viewsCount: views,
            lastUpdated: Date.now(),
          },
          [
            `post_meta:${postId}`,
            `post_likes:${postId}`,
            `post_comments:${postId}`,
          ],
          300,
        ),
      ],
    );
    try {
      await Promise.all(updates);
    } catch (error) {
      logger.warn("[trending] full refresh Redis cache write failed", { error });
      return;
    }

    const dur = performance.now() - start;
    logger.info(
      `[trending] full refresh completed: ${result.data.length} posts updated (${dur.toFixed(1)}ms)`,
    );
  }

  private calculateTrendingScore(post: FeedPost): TrendingScore {
    if (
      !isRecord(post) ||
      typeof post.publicId !== "string" ||
      post.publicId.length === 0
    ) {
      throw new TypeError("Invalid post data for trending score");
    }

    const likes = post.likes ?? 0;
    const comments = post.commentsCount ?? 0;
    const views = post.viewsCount ?? 0;
    const createdAt = new Date(post.createdAt).getTime();
    if (
      typeof likes !== "number" ||
      !Number.isFinite(likes) ||
      likes < 0 ||
      typeof comments !== "number" ||
      !Number.isFinite(comments) ||
      comments < 0 ||
      typeof views !== "number" ||
      !Number.isFinite(views) ||
      views < 0 ||
      !Number.isFinite(createdAt)
    ) {
      throw new TypeError("Invalid post data for trending score");
    }

    const ageDays =
      (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    const recencyScore = 1 / (1 + ageDays);
    const popularityScore = Math.log(likes + 1);
    const commentsScore = Math.log(comments + 1);
    const score =
      this.WEIGHTS.recency * recencyScore +
      this.WEIGHTS.popularity * popularityScore +
      this.WEIGHTS.comments * commentsScore;
    if (
      !Number.isFinite(ageDays) ||
      !Number.isFinite(recencyScore) ||
      !Number.isFinite(popularityScore) ||
      !Number.isFinite(commentsScore) ||
      !Number.isFinite(score)
    ) {
      throw new TypeError("Failed to compute trending score");
    }

    return {
      ageDays,
      comments,
      commentsScore,
      likes,
      popularityScore,
      recencyScore,
      score,
      views,
    };
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
        addRequestContextBreadcrumb("worker.trending.callback.started", {
          worker: "TrendingWorker",
          operation,
        });
        try {
          await work();
          addRequestContextBreadcrumb("worker.trending.callback.completed", {
            worker: "TrendingWorker",
            operation,
          });
        } catch (error) {
          if (this.stopping && isExpectedRedisClientShutdownError(error)) {
            return;
          }
          addRequestContextBreadcrumb("worker.trending.callback.failed", {
            worker: "TrendingWorker",
            operation,
          });
          logNonHttpTerminalError(error, {
            message: "Trending worker background callback failed",
            event: "worker.trending.callback.failed",
            operation: `worker.trending.${operation}`,
            operationId,
            worker: "TrendingWorker",
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

  private sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }
}

function isExpectedRedisClientShutdownError(error: unknown): boolean {
  return (
    error instanceof ClientClosedError || error instanceof DisconnectsClientError
  );
}

const RETRYABLE_REDIS_TRANSPORT_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT",
]);

function isRetryableRedisTransportError(error: unknown): boolean {
  if (
    error instanceof ClientOfflineError ||
    error instanceof ConnectionTimeoutError ||
    error instanceof ReconnectStrategyError ||
    error instanceof RootNodesUnavailableError ||
    error instanceof SocketClosedUnexpectedlyError
  ) {
    return true;
  }
  if (!isRecord(error)) {
    return false;
  }
  return (
    typeof error.code === "string" &&
    RETRYABLE_REDIS_TRANSPORT_CODES.has(error.code)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}
