export enum CacheTTL {
	SHORT = 60, // 1 minute
	MEDIUM = 300, // 5 minutes
	LONG = 900, // 15 minutes (Trending)
	VERY_LONG = 3600, // 1 hour
	DAY = 86400, // 24 hours
	MONTH = 2592000, // 30 days
}

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
