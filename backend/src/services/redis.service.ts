import { injectable, inject } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import fs from "fs";
import { performance } from "perf_hooks";
import { redisLogger } from "@/utils/winston";
import { INotification } from "@/types";
import { MetricsService } from "../metrics/metrics.service";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";
import { RedisNotificationModule } from "./redis/redis-notification.module";
import { RedisFeedModule } from "./redis/redis-feed.module";
import { RedisStreamModule } from "./redis/redis-stream.module";

/**
 * Configuration for resilient Redis operations
 */
interface ResilienceConfig {
	maxAttempts?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	fallbackValue?: any;
}

const DEFAULT_RESILIENCE: Required<Omit<ResilienceConfig, "fallbackValue">> = {
	maxAttempts: 3,
	baseDelayMs: 50,
	maxDelayMs: 1000,
};

/**
 * Facade over Redis modules.
 * - Core cache/tag operations remain here.
 * - Feed, notification, and stream responsibilities are delegated to focused modules.
 */

@injectable()
export class RedisService {
	private client: RedisClientType;
	private readonly notificationModule: RedisNotificationModule;
	private readonly feedModule: RedisFeedModule;
	private readonly streamModule: RedisStreamModule;

	constructor(@inject("MetricsService") private readonly metricsService: MetricsService) {
		const runningInDocker = fs.existsSync("/.dockerenv"); // check if inside docker environment
		const redisUrl = process.env.REDIS_URL || (runningInDocker ? "redis://redis:6379" : "redis://127.0.0.1:6379");

		this.metricsService.setRedisConnectionState(false);

		this.client = createClient({ url: redisUrl });
		this.notificationModule = new RedisNotificationModule(this.client);
		this.feedModule = new RedisFeedModule(this.client);
		this.streamModule = new RedisStreamModule(this.client);

		this.client.on("connect", () => {
			redisLogger.info(`Redis connected`, { url: redisUrl });
			this.metricsService.setRedisConnectionState(true);
		});
		this.client.on("error", (err) => {
			redisLogger.error(`Redis client error`, { error: err.message, stack: err.stack });
			this.metricsService.setRedisConnectionState(false);
		});
		this.client.on("end", () => {
			this.metricsService.setRedisConnectionState(false);
		});

		// avoid opening sockets during unit tests (causes Mocha to hang)
		if (process.env.NODE_ENV !== "test" || process.env.REDIS_AUTOCONNECT === "true") {
			void this.connect();
		}
	}

	get clientInstance(): RedisClientType {
		return this.client;
	}

	private async connect() {
		try {
			await this.client.connect();
			redisLogger.info(`Redis client connection established`);
		} catch (error) {
			redisLogger.error(`Redis connection failed`, {
				error: error instanceof Error ? error.message : String(error),
			});
			this.metricsService.setRedisConnectionState(false);
		}
	}

	/**
	 * Ensures the Redis client is connected.
	 * Useful for workers that need to wait for connection before starting processing loops.
	 */
	async waitForConnection(): Promise<void> {
		if (this.client.isOpen) return;
		return new Promise((resolve) => {
			if (this.client.isOpen) return resolve();
			this.client.once("connect", () => resolve());
		});
	}

	/**
	 * Execute a Redis operation with retry logic and optional fallback
	 * Use for critical cache operations that should be resilient to transient failures
	 */
	async withResilience<T>(operation: () => Promise<T>, config?: ResilienceConfig): Promise<T> {
		const cfg = { ...DEFAULT_RESILIENCE, ...config };
		let lastError: Error | undefined;

		for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
			try {
				return await operation();
			} catch (error: any) {
				lastError = error;

				if (!this.isRetryableRedisError(error) || attempt >= cfg.maxAttempts) {
					if (config?.fallbackValue !== undefined) {
						redisLogger.warn(`Redis operation failed, using fallback`, {
							error: error?.message,
							attempt,
						});
						return config.fallbackValue;
					}
					throw error;
				}

				redisLogger.warn(`Redis operation failed, retrying`, {
					error: error?.message,
					attempt,
					maxAttempts: cfg.maxAttempts,
				});

				await this.backoffWithJitter(attempt, cfg.baseDelayMs, cfg.maxDelayMs);
			}
		}

		if (config?.fallbackValue !== undefined) {
			return config.fallbackValue;
		}
		throw lastError;
	}

	/**
	 * Check if a Redis error is retryable
	 */
	private isRetryableRedisError(error: any): boolean {
		if (!error) return false;
		const message = typeof error.message === "string" ? error.message.toLowerCase() : "";
		const retryablePatterns = [
			"econnreset",
			"econnrefused",
			"etimedout",
			"socket closed",
			"connection",
			"network",
			"busy",
			"loading",
		];
		return retryablePatterns.some((p) => message.includes(p));
	}

	/**
	 * Exponential backoff with jitter for Redis retries
	 */
	private async backoffWithJitter(attempt: number, baseMs: number, maxMs: number): Promise<void> {
		const exponentialDelay = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
		const jitteredDelay = Math.floor(Math.random() * exponentialDelay);
		return new Promise((resolve) => setTimeout(resolve, Math.max(jitteredDelay, 10)));
	}

	/**
	 * Retrieves and parses a JSON value from Redis.
	 *
	 * @wrapper
	 * @why Centralizes JSON.parse() error handling so the process doesn't crash
	 * if Redis contains corrupted data strings.
	 *
	 * @param key - The key to lookup.
	 * @returns {Promise<T | null>} The parsed object or null if missing.
	 */
	async get<T>(key: string): Promise<T | null> {
		const data = await this.client.get(key);
		return data ? JSON.parse(data) : null;
	}

	/**
	 * Serializes and stores a value in Redis.
	 *
	 * @wrapper
	 * @why Centralizes JSON.stringify() to ensure consistent storage formats across the app.
	 *
	 * @param key - Storage key.
	 * @param value - Object to store.
	 * @param ttl - (Optional) Expiration in seconds.
	 */
	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		const stringValue = JSON.stringify(value);
		if (ttl) {
			await this.client.setEx(key, ttl, stringValue);
		} else {
			await this.client.set(key, stringValue);
		}
	}

	/**
	 * Checks existence of a key.
	 *
	 * @complexity O(1)
	 * @returns {Promise<boolean>} True if key exists.
	 */
	async exists(key: string): Promise<boolean> {
		const result = await this.client.exists(key);
		return result === 1;
	}

	/**
	 *  Retrieves the Time-To-Live of a key.
	 *
	 * @usage Cache debugging or deciding whether to refresh a "hot" key before it expires.
	 * @returns {Promise<number>} TTL in seconds, -1 if no expiry, -2 if missing.
	 */
	async ttl(key: string): Promise<number> {
		return await this.client.ttl(key);
	}

	/**
	 * Updates specific fields of a stored JSON object (Read-Modify-Write).
	 *
	 * @pattern Partial Update
	 * @warning Not atomic. If two processes merge different fields simultaneously,
	 * one write might be lost (Race Condition). Use `setWithTags` or Hash structures
	 * for critical atomic updates.
	 *
	 * @param key - Key to update.
	 * @param value - Partial object to merge into existing data.
	 * @param ttl - (Optional) Reset the TTL on update.
	 */
	async merge<T extends Record<string, unknown>>(key: string, value: Partial<T>, ttl?: number): Promise<void> {
		const existing = await this.get<T>(key);
		const next = existing ? { ...existing, ...value } : value;
		await this.set(key, next, ttl);
	}

	/**
	 * Safely deletes keys matching a glob pattern using Cursor Scanning.
	 *
	 * @architecture Non-Blocking Deletion
	 * @why The `KEYS` command is O(N) and blocks the single-threaded Redis event loop,
	 * potentially freezing the entire DB for seconds in production. `SCAN` iterates
	 * incrementally, allowing other commands to run in between batches.
	 *
	 * @param keyPattern - Pattern to match (e.g. `session:*`).
	 * @returns {Promise<number>} Total count of deleted keys.
	 */
	async del(keyPattern: string): Promise<number> {
		let cursor: string | number = 0;
		let deletedCount = 0;
		const batchSize = 100; // delete in batches to avoid memory issues

		do {
			const numericCursor = typeof cursor === "number" ? cursor : Number(cursor);
			const result = (await this.client.scan(numericCursor, {
				MATCH: keyPattern,
				COUNT: batchSize,
			})) as { cursor: number | string; keys: string[] };

			cursor = result.cursor;
			const keys = result.keys;

			if (keys.length > 0) {
				await this.client.del(keys);
				deletedCount += keys.length;
			}
		} while (cursor !== 0 && cursor !== "0");

		redisLogger.info(`[Redis] Deleted ${deletedCount} keys matching pattern: ${keyPattern}`);
		return deletedCount;
	}

	/**
	 * Helper to delete multiple independent patterns sequentially.
	 *
	 * @param patterns - Array of patterns to scan and delete.
	 */
	async deletePatterns(patterns: string[]): Promise<void> {
		await Promise.all(patterns.map((p) => this.del(p)));
	}

	/**
	 * Defensive programming helper: Ensures a key holds the expected data type.
	 *
	 * @strategy Self-Healing
	 * @why If a bug or race condition overwrites a Set key with a String, subsequent
	 * Set operations (SADD) will throw errors. This method detects type mismatches
	 * and purges the corrupted key to allow fresh creation.
	 */
	private async ensureSetKey(key: string): Promise<void> {
		const type = await this.client.type(key);
		if (type !== "none" && type !== "set") {
			await this.client.del(key);
		}
	}

	/**
	 * Broadcasts a message to the entire distributed system.
	 *
	 * @param channel - Target channel.
	 * @param message - Payload (automatically stringified).
	 */
	async publish<T>(channel: string, message: T): Promise<void> {
		await this.client.publish(channel, JSON.stringify(message));
	}

	/**
	 * Subscribes to Redis Pub/Sub channels for real-time inter-service messaging.
	 *
	 * @architecture Event Bus
	 * @why Pub/Sub is "Fire and Forget" (No persistence). Ideal for ephemeral events
	 * like "User Online", "Typing Indicator", or "Cache Invalidation Signals".
	 *
	 * @param channels - List of channels to listen to.
	 * @param messageHandler - Callback function invoked on message receipt.
	 */
	async subscribe<T>(channels: string[], messageHandler: (channel: string, message: T) => void): Promise<void> {
		const subscriber = this.client.duplicate();
		await subscriber.connect();

		await subscriber.subscribe(channels, (message, channel) => {
			try {
				const parsedMessage = JSON.parse(message) as T;
				messageHandler(channel, parsedMessage);
			} catch (error) {
				redisLogger.error("Error parsing Redis message:", { error });
			}
		});
	}

	/**
	 * Stores a value in the cache and associates it with invalidation tags using a Pipeline.
	 *
	 * @pattern Write-Behind / Smart Caching
	 * @why Uses a pipeline to execute the SET and SADD (tag association) commands
	 * atomically. This prevents race conditions where a cache key exists without
	 * its corresponding invalidation tags.
	 *
	 * @param key - The main cache key (e.g., `user:profile:123`).
	 * @param value - The data to store. Will be JSON stringified automatically.
	 * @param tags - An array of string tags (e.g., `['user:123', 'feed:global']`) used for group invalidation.
	 * @param ttl - (Optional) Time-to-live in seconds. Defaults to 600s.
	 * @returns {Promise<void>} Resolves when the pipeline executes successfully.
	 */
	async setWithTags<T>(key: string, value: T, tags: string[], ttl?: number): Promise<void> {
		if (tags.length === 0) {
			await this.set(key, value, ttl);
			return;
		}

		// wrap in resilience for cache write consistency
		return this.withResilience(
			async () => {
				const uniqueTags = [...new Set(tags)];
				const tagTTL = ttl || 600;
				const stringValue = JSON.stringify(value);
				const start = performance.now();
				// make sure tag keys are sets before use
				await Promise.all([
					...uniqueTags.map((tag) => this.ensureSetKey(`tag:${tag}`)),
					this.ensureSetKey(`key_tags:${key}`),
				]);

				// atomic pipeline for setting cache + updating all tags + setting TTLs in one go
				const pipeline = this.client.multi();

				if (ttl) {
					pipeline.setEx(key, ttl, stringValue);
				} else {
					pipeline.set(key, stringValue);
				}

				for (const tag of uniqueTags) {
					const tagKey = `tag:${tag}`;
					pipeline.sAdd(tagKey, key);
					pipeline.expire(tagKey, tagTTL);
				}

				const keyTagKey = `key_tags:${key}`;
				for (const tag of uniqueTags) {
					pipeline.sAdd(keyTagKey, tag);
				}
				pipeline.expire(keyTagKey, tagTTL);

				await pipeline.exec();
				const durationMs = performance.now() - start;
				redisLogger.info(
					`[Redis] setWithTags key=${key} tags=${uniqueTags.length} duration=${durationMs.toFixed(2)}ms`,
				);
			},
			{ maxAttempts: 3, fallbackValue: undefined },
		);
	}

	/**
	 * Invalidates (deletes) all cache keys associated with the provided tags.
	 *
	 * @complexity O(N) where N is the number of keys linked to these tags.
	 * @strategy Fan-out Invalidation. When a user creates a post, invalidate
	 * 'user_feed:ID', 'global_feed', and 'tag:typescript' in one operation.
	 *
	 * @param tags - The list of tags to invalidate (e.g. `['user:123']`).
	 * @returns {Promise<void>} Resolves after all associated keys have been deleted.
	 */
	async invalidateByTags(tags: string[]): Promise<void> {
		if (tags.length === 0) return;

		// wrap in resilience for cache consistency
		return this.withResilience(
			async () => {
				const uniqueTags = [...new Set(tags)];
				const start = performance.now();

				// batch fetch all tag members in one pipeline
				const fetchPipeline = this.client.multi();
				for (const tag of uniqueTags) {
					fetchPipeline.sMembers(`tag:${tag}`);
				}
				const tagResults = await fetchPipeline.exec();

				const keysToDelete = new Set<string>();
				const tagKeysToDelete: string[] = [];

				uniqueTags.forEach((tag, idx) => {
					const tagKey = `tag:${tag}`;
					tagKeysToDelete.push(tagKey);
					const members = tagResults?.[idx] as string[] | null;
					if (Array.isArray(members)) {
						members.forEach((k) => keysToDelete.add(k));
					}
				});

				const deleteTargets: string[] = [];
				for (const key of keysToDelete) {
					deleteTargets.push(key, `key_tags:${key}`);
				}
				deleteTargets.push(...tagKeysToDelete);

				if (deleteTargets.length > 0) {
					await this.client.del(deleteTargets);
				}

				const durationMs = performance.now() - start;
				redisLogger.info(
					`[Redis] invalidateByTags tags=${uniqueTags.length} keys=${keysToDelete.size} deletedKeys=${deleteTargets.length} duration=${durationMs.toFixed(2)}ms`,
				);
			},
			{ maxAttempts: 3, fallbackValue: undefined },
		);
	}

	/**
	 * Retrieval wrapper for Tag-based caching strategy.
	 *
	 * @note Currently an alias for `get`, but serves as an interface contract
	 * implying that the data retrieved is managed by the tagging system.
	 */
	async getWithTags<T>(key: string): Promise<T | null> {
		return await this.get<T>(key);
	}

	// ====== NOTIFICATIONS ======

	async pushNotification(userId: string, notification: INotification, maxCount = 200): Promise<void> {
		return this.notificationModule.pushNotification(userId, notification, maxCount);
	}

	async backfillNotifications(userId: string, notifications: INotification[], maxCount = 200): Promise<void> {
		return this.notificationModule.backfillNotifications(userId, notifications, maxCount);
	}

	async getUserNotifications(userId: string, page = 1, limit = 20): Promise<INotification[]> {
		return this.notificationModule.getUserNotifications(userId, page, limit);
	}

	async markNotificationRead(notificationId: string): Promise<void> {
		return this.notificationModule.markNotificationRead(notificationId);
	}

	async getUnreadNotificationCount(userId: string): Promise<number> {
		return this.notificationModule.getUnreadNotificationCount(userId);
	}

	// ====== FEEDS ======
	async addToFeed(userId: string, postId: string, timestamp: number, feedType = "for_you"): Promise<void> {
		return this.feedModule.addToFeed(userId, postId, timestamp, feedType);
	}

	async addToFeedsBatch(userIds: string[], postId: string, timestamp: number, feedType = "for_you"): Promise<void> {
		return this.feedModule.addToFeedsBatch(userIds, postId, timestamp, feedType);
	}

	async getFeedPage(userId: string, page: number, limit: number, feedType = "for_you"): Promise<string[]> {
		return this.feedModule.getFeedPage(userId, page, limit, feedType);
	}

	async getFeedWithCursor(userId: string, limit: number, cursor?: string, feedType = "for_you"): Promise<{
		ids: string[];
		hasMore: boolean;
		nextCursor?: string;
	}> {
		return this.feedModule.getFeedWithCursor(userId, limit, cursor, feedType);
	}

	async removeFromFeed(userId: string, postId: string, feedType = "for_you"): Promise<void> {
		return this.feedModule.removeFromFeed(userId, postId, feedType);
	}

	async removeFromFeedsBatch(userIds: string[], postId: string, feedType = "for_you"): Promise<void> {
		return this.feedModule.removeFromFeedsBatch(userIds, postId, feedType);
	}

	async invalidateFeed(userId: string, feedType = "for_you"): Promise<void> {
		return this.feedModule.invalidateFeed(userId, feedType);
	}

	async getFeedSize(userId: string, feedType = "for_you"): Promise<number> {
		return this.feedModule.getFeedSize(userId, feedType);
	}

	// ====== MAINTENANCE ======

	/**
	 * Garbage Collector for empty tag sets.
	 *
	 * @maintenance Periodic Cleanup
	 * @complexity O(N) where N is the number of keys scanned.
	 * @why Although Redis expires keys automatically, the tag sets (Reverse Indexes)
	 * can sometimes leave empty shells. This method scans and removes them to
	 * keep memory footprint minimal.
	 */
	async cleanupOrphanedTags(): Promise<void> {
		let cursor: string | number = 0;
		let cleaned = 0;

		do {
			const numericCursor = typeof cursor === "number" ? cursor : Number(cursor);
			const result = (await this.client.scan(numericCursor, {
				MATCH: "tag:*",
				COUNT: 100,
			})) as { cursor: number | string; keys: string[] };

			cursor = result.cursor;

			if (result.keys.length === 0) {
				continue;
			}

			const countPipeline = this.client.multi();
			for (const tagKey of result.keys) {
				countPipeline.sCard(tagKey);
			}
			const counts = await countPipeline.exec();

			const emptyTagKeys: string[] = [];
			result.keys.forEach((tagKey, idx) => {
				const count = Number(counts?.[idx] ?? 0);
				if (count === 0) {
					emptyTagKeys.push(tagKey);
				}
			});

			if (emptyTagKeys.length > 0) {
				await this.client.del(emptyTagKeys);
				cleaned += emptyTagKeys.length;
			}
		} while (cursor !== 0 && cursor !== "0");

		redisLogger.info(`[Redis] Cleaned ${cleaned} empty tag sets`);
	}

	// ====== STREAM / TRENDING ======
	async pushToStream(stream = "stream:interactions", payload: Record<string, unknown>): Promise<string> {
		return this.streamModule.pushToStream(stream, payload);
	}

	async createStreamConsumerGroup(stream = "stream:interactions", group = "trendingGroup"): Promise<void> {
		return this.streamModule.createStreamConsumerGroup(stream, group);
	}

	async ackStreamMessages(stream: string, group: string, ...ids: string[]): Promise<number> {
		return this.streamModule.ackStreamMessages(stream, group, ...ids);
	}

	async updateTrendingScore(postId: string, score: number, key = "trending:global"): Promise<void> {
		return this.feedModule.updateTrendingScore(postId, score, key);
	}

	async incrTrendingScore(postId: string, delta: number, key = "trending:global"): Promise<number> {
		return this.feedModule.incrTrendingScore(postId, delta, key);
	}

	async getTrendingRange(start: number, end: number, key = "trending:posts"): Promise<string[]> {
		return this.feedModule.getTrendingRange(start, end, key);
	}

	async getTrendingCount(key = "trending:posts"): Promise<number> {
		return this.feedModule.getTrendingCount(key);
	}

	async getTrendingFeedWithCursor(limit: number, cursor?: string, key = "trending:posts"): Promise<{
		ids: string[];
		hasMore: boolean;
		nextCursor?: string;
	}> {
		return this.feedModule.getTrendingFeedWithCursor(limit, cursor, key);
	}

	async xPendingRange(stream: string, group: string, start = "-", end = "+", count = 1000): Promise<unknown> {
		return this.streamModule.xPendingRange(stream, group, start, end, count);
	}

	async xClaim(stream: string, group: string, consumer: string, minIdleMs: number, ids: string[]): Promise<unknown> {
		return this.streamModule.xClaim(stream, group, consumer, minIdleMs, ids);
	}

	async zadd(key: string, score: number, member: string): Promise<number> {
		return this.feedModule.zadd(key, score, member);
	}

	async zrangeByScore(key: string, min: string, max: string): Promise<string[]> {
		return this.feedModule.zrangeByScore(key, min, max);
	}

	async zremRangeByScore(key: string, min: string, max: string): Promise<number> {
		return this.feedModule.zremRangeByScore(key, min, max);
	}

	async expire(key: string, seconds: number): Promise<boolean> {
		return this.feedModule.expire(key, seconds);
	}
}
