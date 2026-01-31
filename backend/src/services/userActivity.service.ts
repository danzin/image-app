import { inject, injectable } from "tsyringe";
import { RedisService } from "./redis.service";
import { logger } from "../utils/winston";

export const USER_ACTIVITY_METRICS_KEY = "who_to_follow:activity_metrics";

export interface UserActivityMetrics {
	postCount: number;
	lastUpdated: number;
	recentPostCount: number;
	recentWindowStart: number;
	uniquePosters: number;
}

export const WHO_TO_FOLLOW_TTL_CONFIG = {
	HIGH_ACTIVITY: 300,
	MEDIUM_ACTIVITY: 900,
	LOW_ACTIVITY: 1800,
	VERY_LOW_ACTIVITY: 3600,
	DORMANT: 7200,
};

export const USER_ACTIVITY_THRESHOLDS = {
	HIGH: 20, // 20+ posts/hour = high activity
	MEDIUM: 5, // 5-20 posts/hour = medium
	LOW: 1, // 1-5 posts/hour = low
	VERY_LOW: 0.25, // 0.25-1 posts/hour = very low (1 post every 4 hours)
	// below 0.25 = dormant
};

// thresholds for determining platform size/activity for who to follow strategy
export const PLATFORM_SIZE_THRESHOLDS = {
	// minimum posts per hour to consider "high traffic"
	HIGH_TRAFFIC_POSTS_PER_HOUR: 10,
	// minimum unique posters to consider having "many users"
	MANY_USERS_THRESHOLD: 25,
};

export type PlatformActivityLevel = "high" | "medium" | "low" | "dormant";

@injectable()
export class UserActivityService {
	constructor(@inject("RedisService") private readonly redisService: RedisService) {}

	/**
	 * Track user posting activity for dynamic cache TTL and strategy selection
	 * Called when a post is created
	 */
	async trackPostCreated(userPublicId: string): Promise<void> {
		const now = Date.now();
		const oneHourMs = 3600000;

		try {
			const existing = await this.redisService.get<UserActivityMetrics>(USER_ACTIVITY_METRICS_KEY);

			if (existing) {
				const hoursSinceLastUpdate = (now - existing.lastUpdated) / oneHourMs;

				// exponential decay with ~12 hour half-life for rolling count
				const decayFactor = Math.exp(-hoursSinceLastUpdate / 12);
				const decayedCount = existing.postCount * decayFactor;

				// check if we need to reset the recent window (every hour)
				let recentPostCount = existing.recentPostCount;
				let recentWindowStart = existing.recentWindowStart;

				if (now - existing.recentWindowStart > oneHourMs) {
					// start a new window
					recentPostCount = 1;
					recentWindowStart = now;
				} else {
					// add to current window
					recentPostCount += 1;
				}

				// track unique posters in a rolling set (increment if new activity)
				// for more accurate tracking we could use HyperLogLog but this is good enough fpr now
				const uniquePosters = Math.max(existing.uniquePosters, Math.ceil(decayedCount / 3));

				await this.redisService.set(
					USER_ACTIVITY_METRICS_KEY,
					{
						postCount: decayedCount + 1,
						lastUpdated: now,
						recentPostCount,
						recentWindowStart,
						uniquePosters: uniquePosters + (hoursSinceLastUpdate > 1 ? 1 : 0),
					} as UserActivityMetrics,
					604800, // keep metrics for 1 week
				);
			} else {
				// first activity ever
				await this.redisService.set(
					USER_ACTIVITY_METRICS_KEY,
					{
						postCount: 1,
						lastUpdated: now,
						recentPostCount: 1,
						recentWindowStart: now,
						uniquePosters: 1,
					} as UserActivityMetrics,
					604800,
				);
			}

			// track this specific user as recently active
			await this.trackRecentlyActiveUser(userPublicId);

			logger.debug(`[UserActivityService] Tracked post created by ${userPublicId}`);
		} catch (error) {
			// just log
			logger.warn("[UserActivityService] Error tracking user activity", error);
		}
	}

	/**
	 * Track users who have recently posted (for low-traffic mode)
	 * Uses a sorted set with timestamp scores for easy time-based queries
	 */
	private async trackRecentlyActiveUser(userPublicId: string): Promise<void> {
		const key = "who_to_follow:recently_active_users";
		const score = Date.now();
		const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

		try {
			// add user with current timestamp as score
			await this.redisService.zadd(key, score, userPublicId);

			// clean up entries older than 7 days
			const cutoff = Date.now() - sevenDaysMs;
			await this.redisService.zremRangeByScore(key, "-inf", cutoff.toString());

			// set TTL on the key
			await this.redisService.expire(key, 604800); // 7 days
		} catch (error) {
			logger.warn("[UserActivityService] Error tracking recently active user", error);
		}
	}

	/**
	 * Get recently active user publicIds (users who posted in last N days)
	 */
	async getRecentlyActiveUsers(days: number = 7): Promise<string[]> {
		const key = "who_to_follow:recently_active_users";
		const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

		try {
			const results = await this.redisService.zrangeByScore(key, cutoff.toString(), "+inf");
			return results || [];
		} catch (error) {
			logger.warn("[UserActivityService] Error getting recently active users", error);
			return [];
		}
	}

	/**
	 * Get current activity metrics
	 */
	async getActivityMetrics(): Promise<UserActivityMetrics | null> {
		try {
			return await this.redisService.get<UserActivityMetrics>(USER_ACTIVITY_METRICS_KEY);
		} catch (error) {
			logger.warn("[UserActivityService] Error getting activity metrics", error);
			return null;
		}
	}

	/**
	 * Determine the platform activity level for strategy selection
	 */
	async getPlatformActivityLevel(): Promise<PlatformActivityLevel> {
		try {
			const metrics = await this.getActivityMetrics();

			if (!metrics) {
				// no metrics = new/dormant platform, use low-traffic strategy
				return "dormant";
			}

			const now = Date.now();
			const hoursSinceWindowStart = Math.max(0.1, (now - metrics.recentWindowStart) / 3600000);
			const postsPerHour = metrics.recentPostCount / hoursSinceWindowStart;
			const hoursSinceLastActivity = (now - metrics.lastUpdated) / 3600000;

			// if no activity in last 12 hours, consider dormant
			if (hoursSinceLastActivity > 12) {
				return "dormant";
			}

			if (postsPerHour >= USER_ACTIVITY_THRESHOLDS.HIGH) {
				return "high";
			} else if (postsPerHour >= USER_ACTIVITY_THRESHOLDS.MEDIUM) {
				return "medium";
			} else if (postsPerHour >= USER_ACTIVITY_THRESHOLDS.LOW) {
				return "low";
			}

			return "dormant";
		} catch (error) {
			logger.warn("[UserActivityService] Error determining activity level", error);
			return "dormant";
		}
	}

	/**
	 * Calculate dynamic TTL based on activity level
	 */
	async calculateDynamicTTL(): Promise<number> {
		const level = await this.getPlatformActivityLevel();

		switch (level) {
			case "high":
				return WHO_TO_FOLLOW_TTL_CONFIG.HIGH_ACTIVITY;
			case "medium":
				return WHO_TO_FOLLOW_TTL_CONFIG.MEDIUM_ACTIVITY;
			case "low":
				return WHO_TO_FOLLOW_TTL_CONFIG.LOW_ACTIVITY;
			default:
				return WHO_TO_FOLLOW_TTL_CONFIG.DORMANT;
		}
	}

	/**
	 * Helper to convert TTL seconds to human readable string for logging
	 */
	ttlToHuman(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
		if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
		return `${Math.round(seconds / 86400)}d`;
	}
}
