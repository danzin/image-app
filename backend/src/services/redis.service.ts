import { injectable } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import fs from "fs";
import { performance } from "perf_hooks";
import { redisLogger } from "../utils/winston";
import { INotification } from "../types";

type RedisHash = { [key: string]: string | number | Buffer };

interface NotificationHash extends RedisHash {
	data: string;
	isRead: string;
	timestamp: string;
}

/**
 * Advanced Redis wrapper implementing Tag-based caching, Streams, and Pipelining.
 *
 * @description
 * Implements a "Smart Cache" layer that solves the "Stale Data" problem in distributed systems.
 * - **Tag-based Invalidation**: Maps logical tags (e.g., 'user:123') to sets of keys.
 * - **Pipelines**: Uses Redis pipelines for atomicity on multi-step operations.
 * - **Streams**: Implements consumer groups for high-throughput features.
 */

@injectable()
export class RedisService {
	private client: RedisClientType;

	constructor() {
		const runningInDocker = fs.existsSync("/.dockerenv"); // check if inside docker environment
		const redisUrl = process.env.REDIS_URL || (runningInDocker ? "redis://redis:6379" : "redis://127.0.0.1:6379");

		this.client = createClient({ url: redisUrl });

		this.client.on("connect", () => {
			console.log(`Connected to Redis at ${redisUrl}`);
			redisLogger.info(`Redis connected`, { url: redisUrl });
		});
		this.client.on("error", (err) => {
			console.error("Redis error:", err);
			redisLogger.error(`Redis client error`, { error: err.message, stack: err.stack });
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
			console.error("Redis connection error:", error);
			redisLogger.error(`Redis connection failed`, {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	async get<T>(key: string): Promise<T | null> {
		const data = await this.client.get(key);
		return data ? JSON.parse(data) : null;
	}

	/**
	 * Check if a key exists in Redis
	 */
	async exists(key: string): Promise<boolean> {
		const result = await this.client.exists(key);
		return result === 1;
	}

	/**
	 * Get the TTL (time to live) of a key in seconds
	 * Returns -1 if key exists but has no expiration
	 * Returns -2 if key doesn't exist
	 */
	async ttl(key: string): Promise<number> {
		return await this.client.ttl(key);
	}

	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		const stringValue = JSON.stringify(value);
		if (ttl) {
			await this.client.setEx(key, ttl, stringValue);
		} else {
			await this.client.set(key, stringValue);
		}
	}

	/**
	 * Deletes keys matching a pattern
	 * note: uses SCAN instead of KEYS to avoid blocking Redis
	 * @param keyPattern - Pattern to match (e.g., "feed:*", "feed:user123:*")
	 * @returns Number of keys deleted
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

		console.log(`[Redis] Deleted ${deletedCount} keys matching pattern: ${keyPattern}`);
		return deletedCount;
	}

	/**
	 * Convenience helper for deleting multiple patterns sequentially.
	 * Redis doesn't support multi pattern scan in one call
	 */
	async deletePatterns(patterns: string[]): Promise<void> {
		await Promise.all(patterns.map((p) => this.del(p)));
	}

	/**
	 * Update (merge) JSON value at key if exists or set if not.
	 * for small partial updates like image meta.
	 */
	async merge<T extends Record<string, unknown>>(key: string, value: Partial<T>, ttl?: number): Promise<void> {
		const existing = await this.get<T>(key);
		const next = existing ? { ...existing, ...value } : value;
		await this.set(key, next, ttl);
	}

	/**
	 * Publish a message to a Redis channel
	 */
	async publish<T>(channel: string, message: T): Promise<void> {
		await this.client.publish(channel, JSON.stringify(message));
	}

	/**
	 * Subscribe to Redis channels with a message handler
	 */
	async subscribe<T>(channels: string[], messageHandler: (channel: string, message: T) => void): Promise<void> {
		const subscriber = this.client.duplicate();
		await subscriber.connect();

		await subscriber.subscribe(channels, (message, channel) => {
			try {
				const parsedMessage = JSON.parse(message) as T;
				messageHandler(channel, parsedMessage);
			} catch (error) {
				console.error("Error parsing Redis message:", error);
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
		redisLogger.info(`[Redis] setWithTags key=${key} tags=${uniqueTags.length} duration=${durationMs.toFixed(2)}ms`);
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
			`[Redis] invalidateByTags tags=${uniqueTags.length} keys=${keysToDelete.size} deletedKeys=${deleteTargets.length} duration=${durationMs.toFixed(2)}ms`
		);
	}

	/**
	 * Get cache with automatic tag cleanup on miss
	 * simplified: let TTLs handle cleanup naturally, avoid complex eager cleanup
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
			`[Redis] pushNotification userId=${userId} notification=${notificationId}  duration=${durationMs.toFixed(2)}ms`
		);
	}

	/**
	 * Backfill notifications from MongoDB to Redis in correct order
	 * MongoDB returns newest-first - RPUSH in that order
	 * to maintain newest-first when reading from head with LRANGE
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
	 * Get paginated notifications for user
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
	 * Mark notification as read (O(1) update)
	 */
	async markNotificationRead(notificationId: string): Promise<void> {
		// hash key:notification:${notificationId}; field name: isRead; field value: 1 for read
		await this.client.hSet(`notification:${notificationId}`, "isRead", "1");
	}

	/**
	 * Get unread notification count for user
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
	 * Add post to user's feed (sorted by timestamp)
	 */
	async addToFeed(userId: string, postId: string, timestamp: number, feedType = "for_you"): Promise<void> {
		const feedKey = `feed:${feedType}:${userId}`;
		const pipeline = this.client.multi();
		pipeline.zAdd(feedKey, { score: timestamp, value: postId });
		pipeline.expire(feedKey, 3600); // 1 hour
		await pipeline.exec();
	}

	/**
	 * Add post to multiple users' feeds in batch
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
	 * Get paginated feed posts (newest first)
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
	 * Remove post from user's feed
	 */
	async removeFromFeed(userId: string, postId: string, feedType = "for_you"): Promise<void> {
		await this.client.zRem(`feed:${feedType}:${userId}`, postId);
	}

	/**
	 * Remove post from multiple users' feeds in batch
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
	 * Invalidate entire feed for user (when following/unfollowing)
	 */
	async invalidateFeed(userId: string, feedType = "for_you"): Promise<void> {
		await this.client.del(`feed:${feedType}:${userId}`);
	}

	/**
	 * Get feed size for user
	 */
	async getFeedSize(userId: string, feedType = "for_you"): Promise<number> {
		return await this.client.zCard(`feed:${feedType}:${userId}`);
	}

	// ====== MAINTENANCE ======

	/**
	 * Periodic cleanup: remove empty tag sets and orphaned key_tags
	 *
	 * This could be ran on cron or after major invalidations
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

		console.log(`[Redis] Cleaned ${cleaned} empty tag sets`);
	}

	/**
	 * Ensure the key is a Redis set
	 * @param key
	 */
	private async ensureSetKey(key: string): Promise<void> {
		const type = await this.client.type(key);
		if (type !== "none" && type !== "set") {
			await this.client.del(key);
		}
	}

	//======STREAM / TRENDING HELPERS======

	/**
	 * Push an interaction event into a Redis Stream
	 * payload values that are objects will be JSON.stringified
	 * Returns the XADD id.
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
	 * Create a consumer group for a stream (MKSTREAM)
	 * safe to call repeatedly (ignores BUSYGROUP).
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
	 * Convenience wrapper for XACK
	 */
	async ackStreamMessages(stream: string, group: string, ...ids: string[]): Promise<number> {
		// returns number of messages acknowledged
		const res = await this.client.xAck(stream, group, ids);
		return res as number;
	}

	/**
	 * Update (set) the trending score for a postId in the trending ZSET.
	 */
	async updateTrendingScore(postId: string, score: number, key = "trending:global"): Promise<void> {
		await this.client.zAdd(key, [{ score: Number(score), value: postId }]);
	}

	/**
	 * Increment the trending score (delta) for a postId in the trending ZSET.
	 */
	async incrTrendingScore(postId: string, delta: number, key = "trending:global"): Promise<number> {
		const newScore = await this.client.zIncrBy(key, delta, postId);
		// zIncrBy returns string score in some clients; convert to number
		return Number(newScore);
	}

	/**
	 * Get a range of post IDs from trending sorted set (highest to lowest scores)
	 */
	async getTrendingRange(start: number, end: number, key = "trending:posts"): Promise<string[]> {
		return await this.client.zRange(key, start, end, { REV: true });
	}

	/**
	 * Get total count of posts in trending sorted set
	 */
	async getTrendingCount(key = "trending:posts"): Promise<number> {
		return await this.client.zCard(key);
	}

	/**
	 * Read XPENDING range
	 */
	async xPendingRange(stream: string, group: string, start = "-", end = "+", count = 1000): Promise<unknown> {
		return await this.client.xPendingRange(stream, group, start, end, count);
	}

	/**
	 * Claim messages (XCLAIM)
	 */
	async xClaim(stream: string, group: string, consumer: string, minIdleMs: number, ids: string[]): Promise<unknown> {
		return await this.client.xClaim(stream, group, consumer, minIdleMs, ids);
	}
}
