import { RedisClientType } from "redis";
import { performance } from "perf_hooks";
import { INotification } from "@/types";
import { redisLogger } from "@/utils/winston";

type RedisHash = { [key: string]: string | number | Buffer };

interface NotificationHash extends RedisHash {
	data: string;
	isRead: string;
	timestamp: string;
}

export class RedisNotificationModule {
	constructor(private readonly client: RedisClientType) {}

	async pushNotification(userId: string, notification: INotification, maxCount = 200): Promise<void> {
		const listKey = `notifications:user:${userId}`;
		const notificationId = String(notification._id);
		const hashKey = `notification:${notificationId}`;

		const start = performance.now();
		const pipeline = this.client.multi();
		pipeline.hSet(hashKey, {
			data: JSON.stringify(notification),
			isRead: notification.isRead ? "1" : "0",
			timestamp: String(notification.timestamp),
		});
		pipeline.expire(hashKey, 2592000);
		pipeline.lPush(listKey, notificationId);
		pipeline.lTrim(listKey, 0, maxCount - 1);
		pipeline.expire(listKey, 2592000);
		await pipeline.exec();

		const durationMs = performance.now() - start;
		redisLogger.info(
			`[Redis] pushNotification userId=${userId} notification=${notificationId} duration=${durationMs.toFixed(2)}ms`,
		);
	}

	async backfillNotifications(userId: string, notifications: INotification[], maxCount = 200): Promise<void> {
		const listKey = `notifications:user:${userId}`;
		const start = performance.now();

		await this.client.del(listKey);
		const pipeline = this.client.multi();

		for (const notification of notifications) {
			const notificationId = String(notification._id);
			const hashKey = `notification:${notificationId}`;

			pipeline.hSet(hashKey, {
				data: JSON.stringify(notification),
				isRead: notification.isRead ? "1" : "0",
				timestamp: String(notification.timestamp),
			});
			pipeline.expire(hashKey, 2592000);
			pipeline.rPush(listKey, notificationId);
		}

		pipeline.lTrim(listKey, 0, maxCount - 1);
		pipeline.expire(listKey, 2592000);
		await pipeline.exec();

		const durationMs = performance.now() - start;
		redisLogger.info("Backfilled notifications cache", {
			userId,
			count: notifications.length,
			duration: durationMs.toFixed(2),
		});
	}

	async getUserNotifications(userId: string, page = 1, limit = 20): Promise<INotification[]> {
		const listKey = `notifications:user:${userId}`;
		const start = (page - 1) * limit;
		const end = start + limit - 1;
		const startPerf = performance.now();

		redisLogger.debug("getUserNotifications called", { userId, page, limit, listKey });

		try {
			const notificationIds = await this.client.lRange(listKey, start, end);
			redisLogger.debug("lRange result", { userId, idCount: notificationIds.length });

			if (notificationIds.length === 0) {
				redisLogger.info("No notifications in Redis list", { userId });
				return [];
			}

			const pipeline = this.client.multi();
			for (const id of notificationIds) {
				pipeline.hGetAll(`notification:${id}`);
			}
			const results = (await pipeline.exec()) as unknown as NotificationHash[];

			if (!results) {
				redisLogger.warn("Pipeline returned null results", { userId });
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
			redisLogger.info("getUserNotifications success", { userId, returned: notifications.length, duration });
			return notifications;
		} catch (error) {
			redisLogger.error("getUserNotifications failed", {
				userId,
				error: error instanceof Error ? error.message : String(error),
			});
			return [];
		}
	}

	async markNotificationRead(notificationId: string): Promise<void> {
		await this.client.hSet(`notification:${notificationId}`, "isRead", "1");
	}

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
}
