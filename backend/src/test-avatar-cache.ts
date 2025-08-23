#!/usr/bin/env ts-node

/**
 * Test script to simulate avatar change and verify cache invalidation
 * Run from inside the Docker container
 */

import { createClient } from "redis";

async function testAvatarCacheInvalidation() {
	console.log("=== Testing Avatar Cache Invalidation ===");

	const client = createClient({ url: "redis://redis:6379" });

	try {
		await client.connect();
		console.log("Connected to Redis at redis://redis:6379");

		console.log("1. Checking current Redis keys...");
		const beforeKeys = await client.keys("*");
		console.log(`Keys before invalidation (${beforeKeys.length}):`);
		beforeKeys.forEach((key) => console.log(`  ${key}`));

		console.log("\n2. Simulating avatar change cache invalidation...");

		// Simulate what the UserAvatarChangedHandler does
		const userBatchKeys = await client.keys("user_batch:*");
		const feedKeys = await client.keys("feed:*");
		const coreFeedKeys = await client.keys("core_feed:*");

		const deletionPromises = [];
		if (userBatchKeys.length > 0) deletionPromises.push(client.del(userBatchKeys));
		if (feedKeys.length > 0) deletionPromises.push(client.del(feedKeys));
		if (coreFeedKeys.length > 0) deletionPromises.push(client.del(coreFeedKeys));

		await Promise.all(deletionPromises);

		console.log("3. Checking Redis keys after invalidation...");
		const afterKeys = await client.keys("*");
		console.log(`Keys after invalidation (${afterKeys.length}):`);
		afterKeys.forEach((key) => console.log(`  ${key}`));

		if (beforeKeys.length > 0 && afterKeys.length === 0) {
			console.log("✅ SUCCESS: All cache keys were cleared!");
		} else if (beforeKeys.length === 0) {
			console.log("ℹ️  INFO: No cache keys were present to clear");
		} else {
			console.log("❌ FAILURE: Some cache keys still exist after invalidation");
		}
	} catch (error) {
		console.error("Test failed:", error);
	} finally {
		await client.disconnect();
	}
}

if (require.main === module) {
	testAvatarCacheInvalidation().catch(console.error);
}
