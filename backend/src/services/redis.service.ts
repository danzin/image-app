import { injectable } from "tsyringe";
import { createClient, RedisClientType } from "redis";
import fs from "fs";

@injectable()
export class RedisService {
	private client: RedisClientType;

	constructor() {
		const runningInDocker = fs.existsSync("/.dockerenv");
		const redisUrl = process.env.REDIS_URL || (runningInDocker ? "redis://redis:6379" : "redis://127.0.0.1:6379");

		this.client = createClient({ url: redisUrl });

		this.client.on("connect", () => console.log(`Connected to Redis at ${redisUrl}`));
		this.client.on("error", (err) => console.error("Redis error:", err));

		this.connect();
	}

	private async connect() {
		try {
			await this.client.connect();
		} catch (error) {
			console.error("Redis connection error:", error);
		}
	}

	async get<T = any>(key: string): Promise<T | null> {
		const data = await this.client.get(key);
		return data ? JSON.parse(data) : null;
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
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
		let cursor = 0;
		let deletedCount = 0;
		const batchSize = 100; // delete in batches to avoid memory issues

		do {
			// use SCAN instead of KEYS to avoid blocking Redis
			const result = await this.client.scan(cursor, {
				MATCH: keyPattern,
				COUNT: batchSize,
			});

			cursor = result.cursor;
			const keys = result.keys;

			if (keys.length > 0) {
				await this.client.del(keys);
				deletedCount += keys.length;
			}
		} while (cursor !== 0);

		console.log(`[Redis] Deleted ${deletedCount} keys matching pattern: ${keyPattern}`);
		return deletedCount;
	}

	/**
	 * Convenience helper for deleting multiple patterns sequentially.
	 * (Redis doesn't support multi-pattern scan in one call.)
	 */
	async deletePatterns(patterns: string[]): Promise<void> {
		await Promise.all(patterns.map((p) => this.del(p)));
	}

	/**
	 * Update (merge) JSON value at key if exists; else set. Useful for small partial updates like image meta.
	 */
	async merge(key: string, value: Record<string, any>, ttl?: number): Promise<void> {
		const existing = await this.get<any>(key);
		const next = existing ? { ...existing, ...value } : value;
		await this.set(key, next, ttl);
	}

	/**
	 * Publish a message to a Redis channel
	 */
	async publish(channel: string, message: any): Promise<void> {
		await this.client.publish(channel, JSON.stringify(message));
	}

	/**
	 * Subscribe to Redis channels with a message handler
	 */
	async subscribe(channels: string[], messageHandler: (channel: string, message: any) => void): Promise<void> {
		const subscriber = this.client.duplicate();
		await subscriber.connect();

		await subscriber.subscribe(channels, (message, channel) => {
			try {
				const parsedMessage = JSON.parse(message);
				messageHandler(channel, parsedMessage);
			} catch (error) {
				console.error("Error parsing Redis message:", error);
			}
		});
	}

	/**
	 * Set cache with tags for smart invalidation
	 */
	async setWithTags(key: string, value: any, tags: string[], ttl?: number): Promise<void> {
		await this.set(key, value, ttl);

		// store tag metadata with same TTL as cache key to prevent orphaned tags
		const tagTTL = ttl || 600; // default 10 minutes if no TTL specified

		// Store tag-to-key mapping
		for (const tag of tags) {
			const tagKey = `tag:${tag}`;
			const existingKeys = (await this.get<string[]>(tagKey)) || [];
			if (!existingKeys.includes(key)) {
				existingKeys.push(key);
				await this.set(tagKey, existingKeys, tagTTL);
			}
		}

		// Store key-to-tags mapping for cleanup
		await this.set(`key_tags:${key}`, tags, tagTTL);
	}

	/**
	 * Invalidate cache by tags (smart invalidation)
	 */
	async invalidateByTags(tags: string[]): Promise<void> {
		const keysToDelete = new Set<string>();
		const tagKeysToDelete: string[] = [];

		for (const tag of tags) {
			const tagKey = `tag:${tag}`;
			const keys = (await this.get<string[]>(tagKey)) || [];

			keys.forEach((key) => keysToDelete.add(key));
			tagKeysToDelete.push(tagKey);
		}

		// batch delete for performance
		const allKeysToDelete: string[] = [];

		// add main keys and their tag mappings
		for (const key of keysToDelete) {
			allKeysToDelete.push(key, `key_tags:${key}`);
		}

		// add tag keys
		allKeysToDelete.push(...tagKeysToDelete);

		// delete all in batches of 100
		const batchSize = 100;
		for (let i = 0; i < allKeysToDelete.length; i += batchSize) {
			const batch = allKeysToDelete.slice(i, i + batchSize);
			if (batch.length > 0) {
				await this.client.del(batch);
			}
		}

		console.log(`Invalidated ${keysToDelete.size} cache entries for tags: ${tags.join(", ")}`);
	}

	/**
	 * Get cache with automatic tag cleanup on miss
	 */
	async getWithTags<T = any>(key: string): Promise<T | null> {
		const value = await this.get<T>(key);
		if (value === null) {
			// Clean up tags for missing key
			const tags = await this.get<string[]>(`key_tags:${key}`);
			if (tags) {
				for (const tag of tags) {
					const tagKey = `tag:${tag}`;
					const existingKeys = (await this.get<string[]>(tagKey)) || [];
					const filteredKeys = existingKeys.filter((k) => k !== key);
					if (filteredKeys.length > 0) {
						await this.set(tagKey, filteredKeys);
					} else {
						await this.client.del(tagKey);
					}
				}
				await this.client.del(`key_tags:${key}`);
			}
		}
		return value;
	}
}
