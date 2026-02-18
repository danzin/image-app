import { RedisClientType } from "redis";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";
import { decodeCursor, encodeCursor } from "@/utils/cursorCodec";
import { redisLogger } from "@/utils/winston";

type CursorPayload = {
	score?: number;
	rankScore?: number;
	trendScore?: number;
	createdAt?: string | number;
	_id?: string;
	id?: string;
};

export class RedisFeedModule {
	constructor(private readonly client: RedisClientType) {}

	async addToFeed(userId: string, postId: string, timestamp: number, feedType = "for_you"): Promise<void> {
		const feedKey = CacheKeyBuilder.getRedisFeedKey(feedType, userId);
		const pipeline = this.client.multi();
		pipeline.zAdd(feedKey, { score: timestamp, value: postId });
		pipeline.expire(feedKey, 3600);
		await pipeline.exec();
	}

	async addToFeedsBatch(userIds: string[], postId: string, timestamp: number, feedType = "for_you"): Promise<void> {
		if (userIds.length === 0) return;

		const pipeline = this.client.multi();
		for (const userId of userIds) {
			const feedKey = CacheKeyBuilder.getRedisFeedKey(feedType, userId);
			pipeline.zAdd(feedKey, { score: timestamp, value: postId });
			pipeline.expire(feedKey, 3600);
		}
		await pipeline.exec();
	}

	async getFeedPage(userId: string, page: number, limit: number, feedType = "for_you"): Promise<string[]> {
		const feedKey = CacheKeyBuilder.getRedisFeedKey(feedType, userId);
		const start = (page - 1) * limit;
		const end = start + limit - 1;

		redisLogger.debug("getFeedPage called", { userId, feedType, page, limit, feedKey });

		try {
			const result = await this.client.zRange(feedKey, start, end, { REV: true });
			redisLogger.info("getFeedPage result", { userId, feedType, count: result.length });
			return result;
		} catch (error) {
			redisLogger.error("getFeedPage failed", {
				userId,
				feedType,
				error: error instanceof Error ? error.message : String(error),
			});
			return [];
		}
	}

	async getFeedWithCursor(
		userId: string,
		limit: number,
		cursor?: string,
		feedType = "for_you",
	): Promise<{
		ids: string[];
		hasMore: boolean;
		nextCursor?: string;
	}> {
		const key = CacheKeyBuilder.getRedisFeedKey(feedType, userId);
		const decoded = decodeCursor<CursorPayload>(cursor);
		const maxScoreValue = decoded?.score ?? decoded?.rankScore ?? decoded?.trendScore ?? decoded?.createdAt;
		const maxScore = maxScoreValue !== undefined && maxScoreValue !== null ? String(maxScoreValue) : "+inf";
		const maxId = String(decoded?._id || decoded?.id || "");

		const rawResults = await this.client.zRangeWithScores(key, maxScore, "-inf", {
			BY: "SCORE",
			REV: true,
			LIMIT: { offset: 0, count: limit + 10 },
		} as any);

		let filtered = rawResults;
		if (cursor && maxId) {
			const cursorScore = Number(maxScore);
			filtered = rawResults.filter((item) => {
				if (item.score < cursorScore) return true;
				if (item.score === cursorScore) {
					return item.value < maxId;
				}
				return false;
			});
		}

		const hasMore = filtered.length > limit;
		const sliced = filtered.slice(0, limit);
		const ids = sliced.map((item) => item.value);

		let nextCursor: string | undefined;
		if (sliced.length > 0) {
			const last = sliced[sliced.length - 1];
			nextCursor = encodeCursor({ score: last.score, _id: last.value });
		}

		return { ids, hasMore, nextCursor };
	}

	async removeFromFeed(userId: string, postId: string, feedType = "for_you"): Promise<void> {
		await this.client.zRem(CacheKeyBuilder.getRedisFeedKey(feedType, userId), postId);
	}

	async removeFromFeedsBatch(userIds: string[], postId: string, feedType = "for_you"): Promise<void> {
		if (userIds.length === 0) return;

		const pipeline = this.client.multi();
		for (const userId of userIds) {
			pipeline.zRem(CacheKeyBuilder.getRedisFeedKey(feedType, userId), postId);
		}
		await pipeline.exec();
	}

	async invalidateFeed(userId: string, feedType = "for_you"): Promise<void> {
		await this.client.del(CacheKeyBuilder.getRedisFeedKey(feedType, userId));
	}

	async getFeedSize(userId: string, feedType = "for_you"): Promise<number> {
		return await this.client.zCard(CacheKeyBuilder.getRedisFeedKey(feedType, userId));
	}

	async updateTrendingScore(postId: string, score: number, key = "trending:global"): Promise<void> {
		await this.client.zAdd(key, [{ score: Number(score), value: postId }]);
	}

	async incrTrendingScore(postId: string, delta: number, key = "trending:global"): Promise<number> {
		const newScore = await this.client.zIncrBy(key, delta, postId);
		return Number(newScore);
	}

	async getTrendingRange(start: number, end: number, key = "trending:posts"): Promise<string[]> {
		return await this.client.zRange(key, start, end, { REV: true });
	}

	async getTrendingCount(key = "trending:posts"): Promise<number> {
		return await this.client.zCard(key);
	}

	async getTrendingFeedWithCursor(
		limit: number,
		cursor?: string,
		key = "trending:posts",
	): Promise<{
		ids: string[];
		hasMore: boolean;
		nextCursor?: string;
	}> {
		const decoded = decodeCursor<{ trendScore?: number; _id?: string }>(cursor);
		const maxScore =
			decoded?.trendScore !== undefined && decoded?.trendScore !== null ? String(decoded.trendScore) : "+inf";
		const maxId = String(decoded?._id || "");

		const rawResults = await this.client.zRangeWithScores(key, maxScore, "-inf", {
			BY: "SCORE",
			REV: true,
			LIMIT: { offset: 0, count: limit + 10 },
		} as any);

		let filtered = rawResults;
		if (cursor && maxId) {
			const cursorScore = Number(maxScore);
			filtered = rawResults.filter((item) => {
				if (item.score < cursorScore) return true;
				if (item.score === cursorScore) {
					return item.value < maxId;
				}
				return false;
			});
		}

		const hasMore = filtered.length > limit;
		const sliced = filtered.slice(0, limit);
		const ids = sliced.map((item) => item.value);

		let nextCursor: string | undefined;
		if (sliced.length > 0) {
			const last = sliced[sliced.length - 1];
			nextCursor = encodeCursor({ trendScore: last.score, _id: last.value });
		}

		return { ids, hasMore, nextCursor };
	}

	async zadd(key: string, score: number, member: string): Promise<number> {
		return await this.client.zAdd(key, { score, value: member });
	}

	async zrangeByScore(key: string, min: string, max: string): Promise<string[]> {
		return await this.client.zRangeByScore(key, min, max);
	}

	async zremRangeByScore(key: string, min: string, max: string): Promise<number> {
		return await this.client.zRemRangeByScore(key, min, max);
	}

	async expire(key: string, seconds: number): Promise<boolean> {
		return await this.client.expire(key, seconds);
	}
}
