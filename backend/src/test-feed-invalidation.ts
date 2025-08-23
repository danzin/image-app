#!/usr/bin/env ts-node

/**
 * Test script to simulate Redis cache patterns
 * Run with: npx ts-node src/test-feed-invalidation.ts
 */

import { createClient } from "redis";
import fs from "fs";

async function testFeedInvalidation() {
	console.log("=== Testing Feed Cache Patterns ===");

	const runningInDocker = fs.existsSync("/.dockerenv");
	const redisUrl = process.env.REDIS_URL || (runningInDocker ? "redis://redis:6379" : "redis://127.0.0.1:6379");

	const client = createClient({ url: redisUrl });

	try {
		await client.connect();
		console.log(`Connected to Redis at ${redisUrl}`);

		// Test user ID
		const testUserId = "fedc0e9d-7c5d-47d4-a86f-b94de8b8d2dd";

		console.log("1. Setting up test cache entries...");

		// Set some test cache entries
		await client.set(`feed:${testUserId}:1:10`, JSON.stringify({ test: "legacy feed data" }));
		await client.set(`core_feed:${testUserId}:1:10`, JSON.stringify({ test: "core feed data" }));
		await client.set(`feed:${testUserId}:2:10`, JSON.stringify({ test: "legacy feed page 2" }));
		await client.set(`core_feed:${testUserId}:2:10`, JSON.stringify({ test: "core feed page 2" }));

		console.log("2. Verifying cache entries exist...");
		const beforeLegacy = await client.get(`feed:${testUserId}:1:10`);
		const beforeCore = await client.get(`core_feed:${testUserId}:1:10`);
		console.log("Legacy feed exists:", !!beforeLegacy);
		console.log("Core feed exists:", !!beforeCore);

		console.log("3. Testing wildcard deletion patterns...");

		// Test the deletion patterns used in the handler
		const feedKeys = await client.keys(`feed:${testUserId}:*`);
		const coreFeedKeys = await client.keys(`core_feed:${testUserId}:*`);

		console.log("Feed keys found:", feedKeys);
		console.log("Core feed keys found:", coreFeedKeys);

		// Delete using patterns (simulating the handler logic)
		if (feedKeys.length > 0) {
			await client.del(feedKeys);
		}
		if (coreFeedKeys.length > 0) {
			await client.del(coreFeedKeys);
		}

		console.log("4. Verifying cache entries are invalidated...");
		const afterLegacy = await client.get(`feed:${testUserId}:1:10`);
		const afterCore = await client.get(`core_feed:${testUserId}:1:10`);
		const afterLegacy2 = await client.get(`feed:${testUserId}:2:10`);
		const afterCore2 = await client.get(`core_feed:${testUserId}:2:10`);

		console.log("Legacy feed page 1 after invalidation:", !!afterLegacy);
		console.log("Core feed page 1 after invalidation:", !!afterCore);
		console.log("Legacy feed page 2 after invalidation:", !!afterLegacy2);
		console.log("Core feed page 2 after invalidation:", !!afterCore2);

		if (!afterLegacy && !afterCore && !afterLegacy2 && !afterCore2) {
			console.log("✅ SUCCESS: All cache entries invalidated correctly!");
		} else {
			console.log("❌ FAILURE: Some cache entries still exist");
		}

		// Test current Redis state
		console.log("\n5. Checking current Redis state...");
		const allKeys = await client.keys("*");
		console.log(`Total keys in Redis: ${allKeys.length}`);

		const feedKeysAll = allKeys.filter((k) => k.startsWith("feed:"));
		const coreFeedKeysAll = allKeys.filter((k) => k.startsWith("core_feed:"));

		console.log(`Feed cache keys: ${feedKeysAll.length}`);
		feedKeysAll.forEach((key) => console.log(`  ${key}`));

		console.log(`Core feed cache keys: ${coreFeedKeysAll.length}`);
		coreFeedKeysAll.forEach((key) => console.log(`  ${key}`));
	} catch (error) {
		console.error("Test failed:", error);
	} finally {
		await client.disconnect();
	}
}

if (require.main === module) {
	testFeedInvalidation().catch(console.error);
}
