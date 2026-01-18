export class CacheKeyBuilder {
	static readonly PREFIXES = {
		USER_BATCH: "user_batch",
		USER_DATA: "user_data",
		POST_META: "post_meta",
		CORE_FEED: "core_feed",
		TRENDING_TAGS: "trending_tags",
		USER_FEED: "user_feed",
		USER_FOR_YOU: "user_for_you_feed",
	};

	static getUserBatchKey(userPublicIds: string[]): string {
		return `${this.PREFIXES.USER_BATCH}:${userPublicIds.sort().join(",")}`;
	}

	static getUserDataKey(userPublicId: string): string {
		return `${this.PREFIXES.USER_DATA}:${userPublicId}`;
	}

	static getPostMetaKey(postPublicId: string): string {
		return `${this.PREFIXES.POST_META}:${postPublicId}`;
	}

	static getCoreFeedKey(userId: string, page: number, limit: number): string {
		return `${this.PREFIXES.CORE_FEED}:${userId}:${page}:${limit}`;
	}

	static getTrendingTagsKey(limit: number, timeWindow: number): string {
		return `${this.PREFIXES.TRENDING_TAGS}:${limit}:${timeWindow}`;
	}

	static getTrendingTagsPrefix(): string {
		return `${this.PREFIXES.TRENDING_TAGS}`;
	}
}
