export enum CacheTTL {
	SHORT = 60, // 1 minute
	MEDIUM = 300, // 5 minutes
	LONG = 900, // 15 minutes
	VERY_LONG = 3600, // 1 hour
	DAY = 86400, // 24 hours
	WEEK = 604800, // 7 days
	MONTH = 2592000, // 30 days
}

/**
 * Adaptive TTL configuration for dynamic caching based on platform activity
 * Used by trending tags, who to follow, and other activity-sensitive features
 */
export const AdaptiveTTL = {
	// TTL values based on activity level
	TRENDING_TAGS: {
		HIGH_ACTIVITY: CacheTTL.MEDIUM, // 5 minutes - lots of new tags
		MEDIUM_ACTIVITY: 1800, // 30 minutes
		LOW_ACTIVITY: CacheTTL.DAY, // 1 day
		VERY_LOW_ACTIVITY: CacheTTL.WEEK, // 1 week
		DORMANT: CacheTTL.MONTH, // 30 days - site basically inactive
		HISTORICAL: 3888000, // 45 days - fallback historical data
	},
	WHO_TO_FOLLOW: {
		HIGH_ACTIVITY: CacheTTL.MEDIUM, // 5 minutes - lots of new users posting
		MEDIUM_ACTIVITY: CacheTTL.LONG, // 15 minutes
		LOW_ACTIVITY: 1800, // 30 minutes
		VERY_LOW_ACTIVITY: CacheTTL.VERY_LONG, // 1 hour
		DORMANT: 7200, // 2 hours - check periodically even when dormant
	},
	// activity metrics storage TTL
	METRICS_STORAGE: CacheTTL.WEEK,
};

/**
 * Activity thresholds for determining platform activity level
 * Rates are measured in events per hour
 */
export const ActivityThresholds = {
	TAGS: {
		HIGH: 10, // 10+ tags/hour = high activity
		MEDIUM: 2, // 2-10 tags/hour = medium
		LOW: 0.5, // 0.5-2 tags/hour = low (1 tag every 2 hours)
		VERY_LOW: 0.1, // 0.1-0.5 tags/hour = very low (1 tag every 10 hours)
		// below 0.1 = dormant
	},
	POSTS: {
		HIGH: 20, // 20+ posts/hour = high activity
		MEDIUM: 5, // 5-20 posts/hour = medium
		LOW: 1, // 1-5 posts/hour = low
		VERY_LOW: 0.25, // 0.25-1 posts/hour = very low (1 post every 4 hours)
		// below 0.25 = dormant
	},
	// hours of inactivity before considering the platform dormant
	DORMANT_HOURS: {
		TAGS: 24,
		POSTS: 12,
	},
};

/**
 * Platform size thresholds for strategy selection
 */
export const PlatformSizeThresholds = {
	// minimum posts per hour to consider "high traffic"
	HIGH_TRAFFIC_POSTS_PER_HOUR: 10,
	// minimum unique posters to consider having "many users"
	MANY_USERS_THRESHOLD: 25,
};

export const CacheConfig = {
	FEED: {
		NEW_FEED: CacheTTL.VERY_LONG,
		TRENDING_FEED: 120, // 2 minutes
		CORE_FEED: CacheTTL.VERY_LONG,
		USER_DATA: CacheTTL.SHORT,
		POST_META: CacheTTL.SHORT,
	},
	TAGS: {
		TRENDING: CacheTTL.LONG,
	},
	NOTIFICATIONS: {
		TTL: CacheTTL.MONTH,
	},
	USERS: {
		RECOMMENDATIONS: 1800, // 30 minutes
	},
};
