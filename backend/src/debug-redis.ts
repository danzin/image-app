#!/usr/bin/env ts-node

/**
 * Redis debugging script to inspect cache keys and values
 * npx ts-node src/debug-redis.ts
 */

import { createClient } from "redis";
import fs from "fs";

async function debugRedis() {
	const runningInDocker = fs.existsSync("/.dockerenv");
	const redisUrl = process.env.REDIS_URL || (runningInDocker ? "redis://redis:6379" : "redis://127.0.0.1:6379");

	const client = createClient({ url: redisUrl });

	try {
		await client.connect();
		console.log(`Connected to Redis at ${redisUrl}`);

		// List all keys
		const allKeys = await client.keys("*");
		console.log(`\n=== All Redis Keys (${allKeys.length} total) ===`);

		// Group keys by pattern
		const keyPatterns = {
			feed: allKeys.filter((k) => k.startsWith("feed:")),
			core_feed: allKeys.filter((k) => k.startsWith("core_feed:")),
			image_meta: allKeys.filter((k) => k.startsWith("image_meta:")),
			user_batch: allKeys.filter((k) => k.startsWith("user_batch:")),
			other: allKeys.filter(
				(k) =>
					!k.startsWith("feed:") &&
					!k.startsWith("core_feed:") &&
					!k.startsWith("image_meta:") &&
					!k.startsWith("user_batch:")
			),
		};

		Object.entries(keyPatterns).forEach(([pattern, keys]) => {
			if (keys.length > 0) {
				console.log(`\n${pattern.toUpperCase()} Keys (${keys.length}):`);
				keys.forEach((key) => console.log(`  ${key}`));
			}
		});

		// Show sample values for feed keys
		console.log("\n=== Sample Feed Values ===");
		const sampleFeedKeys = [...keyPatterns.feed, ...keyPatterns.core_feed].slice(0, 3);

		for (const key of sampleFeedKeys) {
			try {
				const value = await client.get(key);
				const parsed = value ? JSON.parse(value) : null;
				console.log(`\n${key}:`);
				if (parsed && Array.isArray(parsed.data)) {
					console.log(`  - Type: ${parsed.data ? "array" : "unknown"}`);
					console.log(`  - Length: ${parsed.data?.length || 0}`);
					console.log(`  - Total: ${parsed.total || "unknown"}`);
					console.log(`  - Sample item:`, parsed.data?.[0] ? Object.keys(parsed.data[0]) : "none");
				} else if (parsed && Array.isArray(parsed)) {
					console.log(`  - Type: array (legacy format)`);
					console.log(`  - Length: ${parsed.length}`);
					console.log(`  - Sample item:`, parsed[0] ? Object.keys(parsed[0]) : "none");
				} else {
					console.log(`  - Value type: ${typeof parsed}`);
				}
			} catch (error) {
				console.log(`  - Error reading value: ${error}`);
			}
		}

		// Show TTL info
		console.log("\n=== TTL Information ===");
		for (const key of sampleFeedKeys) {
			const ttl = await client.ttl(key);
			console.log(`${key}: ${ttl === -1 ? "no expiry" : ttl === -2 ? "expired/not found" : `${ttl}s remaining`}`);
		}
	} catch (error) {
		console.error("Redis debug error:", error);
	} finally {
		await client.disconnect();
	}
}

if (require.main === module) {
	debugRedis().catch(console.error);
}

export { debugRedis };
