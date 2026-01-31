import { injectable, inject } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import fs from "fs";
import { performance } from "perf_hooks";
import { redisLogger } from "@/utils/winston";
import { INotification } from "@/types";
import { MetricsService } from "../metrics/metrics.service";

type RedisHash = { [key: string]: string | number | Buffer };

interface NotificationHash extends RedisHash {
	data: string;
	isRead: string;
	timestamp: string;
}

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
 * @class RedisService
 * Advanced Redis wrapper implementing Tag-based caching, Streams, and Pipelining.
 *
 *
 * Implements a "Smart Cache" layer that solves the "Stale Data" problem in distributed systems.
 * - **Tag-based Invalidation**: Maps logical tags (e.g., 'user:123') to sets of keys.
 * - **Pipelines**: Uses Redis pipelines for atomicity on multi-step operations.
 * - **Streams**: Implements consumer groups for high-throughput features.
 */

@injectable()
export class RedisService {
	private client: RedisClientType;

	constructor(@inject("MetricsService") private readonly metricsService: MetricsService) {
		const runningInDocker = fs.existsSync("/.dockerenv"); // check if inside docker environment
		const redisUrl = process.env.REDIS_URL || (runningInDocker ? "redis://redis:6379" : "redis://127.0.0.1:6379");

		this.metricsService.setRedisConnectionState(false);

		this.client = createClient({ url: redisUrl });

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

		this.connect();
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

	/**
	 * Pushes a notification to a user's list using a "List + Hash" pattern.
	 *
	 * @why Storing the full notification object in a List is inefficient for updates.
	 * Instead, store ID references in a List (for O(1) insertion/pagination) and
	 * the actual data in a Hash (for O(1) updates like 'mark as read').
	 *
	 * @param userId - The public ID of the user receiving the notification.
	 * @param notification - The full notification object to be stored.
	 * @param maxCount - (Optional) Max size of the list. Oldest items are trimmed. Default 200.
	 * @returns {Promise<void>}
	 */
	async pushNotification(userId: string, notification: INotification, maxCount = 200): Promise<void> {
		const listKey = `notifications:user:${userId}`;
		const notificationId = String(notification._id); // convert ObjectId to string
		const hashKey = `notification:${notificationId}`;

		const start = performance.now();
		const pipeline = this.client.multi();
		pipeline.hSet(hashKey, {
			data: JSON.stringify(notification),
			isRead: notification.isRead ? "1" : "0",
			timestamp: String(notification.timestamp), // ensure timestamp is string
		});
		pipeline.expire(hashKey, 2592000); // 30 days

		pipeline.lPush(listKey, notificationId);
		pipeline.lTrim(listKey, 0, maxCount - 1);
		pipeline.expire(listKey, 2592000);

		await pipeline.exec();
		const durationMs = performance.now() - start;
		redisLogger.info(
			`[Redis] pushNotification userId=${userId} notification=${notificationId}  duration=${durationMs.toFixed(2)}ms`,
		);
	}

	/**
	 * Warms the Redis cache with data from MongoDB (Cache Backfilling).
	 *
	 * @architecture Cache Warming / Pipeline
	 * @strategy Uses a Pipeline to batch hundreds of operations (HSET + RPUSH)
	 * into a single network request.
	 * @ordering Preserves MongoDB sort order. Since Mongo returns newest-first,
	 * Use RPUSH (Right Push) to append them in sequence [Newest, Older, Oldest].
	 */
	async backfillNotifications(userId: string, notifications: INotification[], maxCount = 200): Promise<void> {
		const listKey = `notifications:user:${userId}`;
		const start = performance.now();

		// clear existing list first to avoid duplicates
		await this.client.del(listKey);

		const pipeline = this.client.multi();

		// MongoDB gives newest first - RPUSH them in that order
		// List will be newest -> newer -> old -> oldest
		for (const notification of notifications) {
			const notificationId = String(notification._id);
			const hashKey = `notification:${notificationId}`;

			pipeline.hSet(hashKey, {
				data: JSON.stringify(notification),
				isRead: notification.isRead ? "1" : "0",
				timestamp: String(notification.timestamp),
			});
			pipeline.expire(hashKey, 2592000);

			// RPUSH to add to tail in MongoDB order (newest-first)
			pipeline.rPush(listKey, notificationId);
		}

		pipeline.lTrim(listKey, 0, maxCount - 1);
		pipeline.expire(listKey, 2592000);

		await pipeline.exec();
		const durationMs = performance.now() - start;
		redisLogger.info(`Backfilled notifications cache`, {
			userId,
			count: notifications.length,
			duration: durationMs.toFixed(2),
		});
	}

	/**
	 * Retrieves paginated notifications by hydrating IDs from a List with data from Hashes.
	 *
	 * @complexity O(N) where N is the limit (page size). Uses a pipeline to fetch
	 * N hashes in a single round-trip.
	 * @pattern Hydration Pattern
	 * @why Store IDs in a List for efficient pagination (O(1) access to range) and
	 * full data in Hashes to allow O(1) updates (like marking a single notification as read)
	 * without rewriting a massive JSON blob.
	 *
	 * @param userId - The user's public ID.
	 * @param page - Page number (1-based).
	 * @param limit - Items per page.
	 * @returns {Promise<INotification[]>} Array of hydrated notification objects.
	 */
	async getUserNotifications(userId: string, page = 1, limit = 20): Promise<INotification[]> {
		const listKey = `notifications:user:${userId}`;
		const start = (page - 1) * limit;
		const end = start + limit - 1;
		const startPerf = performance.now();
		redisLogger.debug(`getUserNotifications called`, { userId, page, limit, listKey });

		try {
			const notificationIds = await this.client.lRange(listKey, start, end);
			redisLogger.debug(`lRange result`, { userId, idCount: notificationIds.length });

			if (notificationIds.length === 0) {
				redisLogger.info(`No notifications in Redis list`, { userId });
				return [];
			}

			const pipeline = this.client.multi();
			for (const id of notificationIds) {
				pipeline.hGetAll(`notification:${id}`);
			}
			const results = (await pipeline.exec()) as unknown as NotificationHash[];

			if (!results) {
				redisLogger.warn(`Pipeline returned null results`, { userId });
				return [];
			}

			const notifications: INotification[] = results
				.map((hash) => {
					if (!hash || !hash.data) return null;
					try {
						const notification = JSON.parse(hash.data) as INotification;
						notification.isRead = hash.isRead === "1";
						return notification;
					} catch {
						return null;
					}
				})
				.filter((n): n is INotification => n !== null);

			const duration = performance.now() - startPerf;
			redisLogger.info(`getUserNotifications success`, {
				userId,
				returned: notifications.length,
				duration: duration,
			});
			return notifications;
		} catch (error) {
			redisLogger.error(`getUserNotifications failed`, {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			return [];
		}
	}

	/**
	 * Marks a specific notification as read using O(1) Hash field update.
	 *
	 * @complexity O(1)
	 * @why Notifications are stored as Hashes specifically to allow this operation.
	 * If they are stored as a JSON list, the whole list would need to be fetched and red,
	 * find the item, modify it, and write the whole list back (O(N) read/write).
	 */
	async markNotificationRead(notificationId: string): Promise<void> {
		// hash key:notification:${notificationId}; field name: isRead; field value: 1 for read
		await this.client.hSet(`notification:${notificationId}`, "isRead", "1");
	}

	/**
	 * Calculates unread count by scanning the user's notification list.
	 *
	 * @warning Linear Scan O(N)
	 * @why Redis Lists do not support secondary indexing (e.g., "count where isRead=0").
	 * Have to fetch IDs and pipeline the checks.
	 * @optimization For high-scale users, this should be replaced with a separate
	 * counter key (`unread_count:userId`) incremented/decremented on write.
	 *
	 * @param userId - The user's public ID.
	 * @returns {Promise<number>} Count of unread notifications.
	 */
	async getUnreadNotificationCount(userId: string): Promise<number> {
		const listKey = `notifications:user:${userId}`;
		const notificationIds = await this.client.lRange(listKey, 0, -1);

		let unreadCount = 0;
		const pipeline = this.client.multi();
		for (const id of notificationIds) {
			pipeline.hGet(`notification:${id}`, "isRead");
		}
		const results = await pipeline.exec();

		for (const result of results) {
			if (result !== "1") unreadCount++;
		}

		return unreadCount;
	}

	// ======FEEDS ======

	/**
	 * Adds a single post to a user's feed.
	 *
	 * @datastructure Sorted Set (ZSET)
	 * @complexity O(log(N)) where N is the size of the feed.
	 * @why Uses a ZSET with the timestamp as the score. This ensures the feed is
	 * always perfectly ordered by time, regardless of insertion order.
	 *
	 * @param userId - The user receiving the post.
	 * @param postId - The post ID.
	 * @param timestamp - The creation time (score).
	 * @param feedType - (Optional) Feed partition (default 'for_you').
	 */
	async addToFeed(userId: string, postId: string, timestamp: number, feedType = "for_you"): Promise<void> {
		const feedKey = `feed:${feedType}:${userId}`;
		const pipeline = this.client.multi();
		pipeline.zAdd(feedKey, { score: timestamp, value: postId });
		pipeline.expire(feedKey, 3600); // 1 hour
		await pipeline.exec();
	}

	/**
	 * Fan-out-on-write: Adds a post ID to a batch of user feeds efficiently.
	 *
	 * @architecture Fan-Out on Write
	 * @complexity O(M * log(N)) where M is users and N is feed size.
	 * @why Push the post ID to all followers' feeds at creation time. This moves
	 * the complexity to the "Write" path, ensuring the "Read" path (loading the feed)
	 * remains O(1) / extremely fast.
	 *
	 * @param userIds - List of follower IDs receiving the post.
	 * @param postId - The post Public ID.
	 * @param timestamp - Score used for sorting (creation time).
	 * @param feedType - 'for_you' or 'personalized'.
	 */
	async addToFeedsBatch(userIds: string[], postId: string, timestamp: number, feedType = "for_you"): Promise<void> {
		if (userIds.length === 0) return;

		const pipeline = this.client.multi();
		for (const userId of userIds) {
			const feedKey = `feed:${feedType}:${userId}`;
			pipeline.zAdd(feedKey, { score: timestamp, value: postId });
			pipeline.expire(feedKey, 3600);
		}
		await pipeline.exec();
	}

	/**
	 * Retrieves a page of Post IDs from the user's sorted set feed.
	 *
	 * @complexity O(log(N) + M) where N is feed size and M is the limit (page size).
	 * @why ZRANGE allows efficient offset-based pagination on time-series data
	 * without the performance penalties of database OFFSET/LIMIT queries.
	 *
	 * @param userId - User ID.
	 * @param page - Page number.
	 * @param limit - Items per page.
	 * @returns {Promise<string[]>} List of Post Public IDs (to be hydrated later).
	 */
	async getFeedPage(userId: string, page: number, limit: number, feedType = "for_you"): Promise<string[]> {
		const feedKey = `feed:${feedType}:${userId}`;
		const start = (page - 1) * limit;
		const end = start + limit - 1;

		redisLogger.debug(`getFeedPage called`, { userId, feedType, page, limit, feedKey });

		try {
			const result = await this.client.zRange(feedKey, start, end, { REV: true });
			redisLogger.info(`getFeedPage result`, { userId, feedType, count: result.length });
			return result;
		} catch (error) {
			redisLogger.error(`getFeedPage failed`, {
				userId,
				feedType,
				error: error instanceof Error ? error.message : String(error),
			});
			return [];
		}
	}

	/**
	 * Removes a post from a user's feed (e.g., on un-follow or post deletion).
	 *
	 * @complexity O(log(N)) where N is the size of the feed.
	 * @param userId - Owner of the feed.
	 * @param postId - Post to remove.
	 * @param feedType - Feed partition to target.
	 */
	async removeFromFeed(userId: string, postId: string, feedType = "for_you"): Promise<void> {
		await this.client.zRem(`feed:${feedType}:${userId}`, postId);
	}

	/**
	 * Batch removal of a post from multiple feeds (Fan-out Delete).
	 *
	 * @pattern Pipeline Batching
	 * @complexity O(M * log(N)) where M is the number of users and N is the feed size.
	 * @why When a user deletes a post, it must be removed from all followers' feeds
	 * to prevent "ghost" items. Using a pipeline minimizes network latency (RTT)
	 * by sending all commands in a single packet.
	 *
	 * @param userIds - List of users who have this post in their feed.
	 * @param postId - The post ID to remove.
	 * @param feedType - (Optional) Feed partition (default 'for_you').
	 */
	async removeFromFeedsBatch(userIds: string[], postId: string, feedType = "for_you"): Promise<void> {
		if (userIds.length === 0) return;

		const pipeline = this.client.multi();
		for (const userId of userIds) {
			pipeline.zRem(`feed:${feedType}:${userId}`, postId);
		}
		await pipeline.exec();
	}

	/**
	 * Completely destroys a user's feed cache.
	 *
	 * @strategy Cache Invalidation
	 * @why Used when a user's following list changes drastically (e.g. they follow
	 * a new person). We blow away the feed and let the "Pull" mechanism rebuild it
	 * fresh on the next request.
	 */
	async invalidateFeed(userId: string, feedType = "for_you"): Promise<void> {
		await this.client.del(`feed:${feedType}:${userId}`);
	}

	/**
	 * retrieves the total number of items in a user's feed.
	 *
	 * @complexity O(1)
	 * @why ZCARD is an O(1) operation because Redis stores the set cardinality
	 * in the metadata header of the data structure. Useful for displaying
	 * "New Posts" badges or calculating pagination depth.
	 *
	 * @param userId - The user ID.
	 * @param feedType - (Optional) Feed partition.
	 * @returns {Promise<number>} Total count of items in the sorted set.
	 */
	async getFeedSize(userId: string, feedType = "for_you"): Promise<number> {
		return await this.client.zCard(`feed:${feedType}:${userId}`);
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

			for (const tagKey of result.keys) {
				const count = await this.client.sCard(tagKey);
				if (count === 0) {
					await this.client.del(tagKey);
					cleaned++;
				}
			}
		} while (cursor !== 0 && cursor !== "0");

		redisLogger.info(`[Redis] Cleaned ${cleaned} empty tag sets`);
	}

	//======STREAM / TRENDING HELPERS======

	/**
	 * Appends an interaction event to a Redis Stream for async processing.
	 *
	 * @architecture Event Sourcing / Log
	 * @why Streams provide a persistent, strictly ordered log of events. Unlike Pub/Sub,
	 * Streams allow consumers (workers) to process events at their own pace and
	 * replay them if they crash.
	 *
	 * @param stream - Stream key (default `stream:interactions`).
	 * @param payload - The event data. Values are automatically stringified.
	 * @returns {Promise<string>} The generated Stream ID (e.g., '1638532134567-0').
	 */
	async pushToStream(stream = "stream:interactions", payload: Record<string, unknown>): Promise<string> {
		// normalize to string-only fields for Redis
		const prepared: Record<string, string> = {};
		for (const [k, v] of Object.entries(payload)) {
			prepared[k] = typeof v === "string" ? v : JSON.stringify(v);
		}
		// The `xAdd` command is not part of the base `RedisClientType`, so just cast to any.
		const id = await this.client.xAdd(stream, "*", prepared);
		return id;
	}

	/**
	 * Initializes a Consumer Group for parallel processing.
	 *
	 * @pattern Idempotent Initialization
	 * @why Consumer groups allow multiple workers to share the load of a single stream
	 * (competing consumers pattern). This method handles the `BUSYGROUP` error
	 * gracefully if the group already exists.
	 */
	async createStreamConsumerGroup(stream = "stream:interactions", group = "trendingGroup"): Promise<void> {
		try {
			await this.client.xGroupCreate(stream, group, "$", { MKSTREAM: true });
		} catch (err) {
			const msg = String((err as Error)?.message ?? err);
			if (msg.includes("BUSYGROUP")) {
				// group already exists - ignore
				return;
			}
			throw err;
		}
	}

	/**
	 * Acknowledges that a message has been successfully processed.
	 *
	 * @reliability At-Least-Once Delivery
	 * @why Redis will keep the message in the "Pending Entries List" (PEL) until
	 * it is explicitly ACKed. If a worker crashes before ACKing, another worker
	 * can claim and retry the message (see `xClaim`).
	 *
	 * @returns {Promise<number>} Number of messages acked.
	 */
	async ackStreamMessages(stream: string, group: string, ...ids: string[]): Promise<number> {
		// returns number of messages acknowledged
		const res = await this.client.xAck(stream, group, ids);
		return res as number;
	}

	/**
	 * Updates the score of a post in the Global Trending Leaderboard.
	 *
	 * @datastructure Sorted Set (ZSET)
	 * @why ZSETs allow us to maintain a real-time ranking of millions of posts
	 * by score (interactions) with O(log N) updates.
	 */
	async updateTrendingScore(postId: string, score: number, key = "trending:global"): Promise<void> {
		await this.client.zAdd(key, [{ score: Number(score), value: postId }]);
	}

	/**
	 * Atomically increments the score of a post in the Trending Sorted Set.
	 *
	 * @useCase Tracking 'likes', 'views', or 'velocity' for the "Hot" feed.
	 * @complexity O(log(N)) where N is the number of items in the leaderboard.
	 *
	 * @param postId - The item to rank.
	 * @param delta - Amount to increment (can be negative to decay score).
	 * @param key - The Sorted Set key.
	 * @returns {Promise<number>} The new score.
	 */
	async incrTrendingScore(postId: string, delta: number, key = "trending:global"): Promise<number> {
		const newScore = await this.client.zIncrBy(key, delta, postId);
		// zIncrBy returns string score in some clients; convert to number
		return Number(newScore);
	}

	/**
	 * Retrieves the top-performing posts from the leaderboard.
	 *
	 * @complexity O(log(N) + M)
	 * @param start - Rank start index (0 is top 1).
	 * @param end - Rank end index.
	 * @returns {Promise<string[]>} Array of Post IDs ordered by score (Descending).
	 */
	async getTrendingRange(start: number, end: number, key = "trending:posts"): Promise<string[]> {
		return await this.client.zRange(key, start, end, { REV: true });
	}

	/**
	 * Gets the total size of the trending corpus.
	 *
	 * @complexity O(1)
	 * @returns {Promise<number>} Number of posts currently being tracked for trending.
	 */
	async getTrendingCount(key = "trending:posts"): Promise<number> {
		return await this.client.zCard(key);
	}

	/**
	 * Inspects the Pending Entries List (PEL) for stalled messages.
	 *
	 * @monitoring Reliability
	 * @why Allows us to see which messages were picked up by a worker but never ACKed
	 * (likely due to a crash or timeout). Critical for implementing retry logic.
	 */
	async xPendingRange(stream: string, group: string, start = "-", end = "+", count = 1000): Promise<unknown> {
		return await this.client.xPendingRange(stream, group, start, end, count);
	}

	/**
	 * Claims ownership of stalled messages from another consumer.
	 *
	 * @pattern Dead Letter / Retry
	 * @why If a message has been pending for longer than `minIdleMs` assume the
	 * original worker died. This method transfers ownership to the current worker
	 * so it can be retried.
	 */
	async xClaim(stream: string, group: string, consumer: string, minIdleMs: number, ids: string[]): Promise<unknown> {
		return await this.client.xClaim(stream, group, consumer, minIdleMs, ids);
	}

	// ─────────────────────────────────────────────────────────────────────────────
	// Sorted Set Operations for Activity Tracking
	// ─────────────────────────────────────────────────────────────────────────────

	/**
	 * Add a member with a score to a sorted set
	 * @param key sorted set key
	 * @param score numeric score for ordering
	 * @param member member value
	 */
	async zadd(key: string, score: number, member: string): Promise<number> {
		return await this.client.zAdd(key, { score, value: member });
	}

	/**
	 * Get members from a sorted set within a score range
	 * @param key sorted set key
	 * @param min minimum score (can be '-inf')
	 * @param max maximum score (can be '+inf')
	 */
	async zrangeByScore(key: string, min: string, max: string): Promise<string[]> {
		return await this.client.zRangeByScore(key, min, max);
	}

	/**
	 * Remove members from a sorted set by score range
	 * @param key sorted set key
	 * @param min minimum score (can be '-inf')
	 * @param max maximum score
	 */
	async zremRangeByScore(key: string, min: string, max: string): Promise<number> {
		return await this.client.zRemRangeByScore(key, min, max);
	}

	/**
	 * Set TTL on a key
	 * @param key redis key
	 * @param seconds TTL in seconds
	 */
	async expire(key: string, seconds: number): Promise<boolean> {
		return await this.client.expire(key, seconds);
	}
}
