import { ClientSession, Model } from "mongoose";
import { INotification } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class NotificationRepository extends BaseRepository<INotification> {
	constructor(@inject("NotificationModel") model: Model<INotification>) {
		super(model);
	}

	async create(notificationData: Partial<INotification>, session?: ClientSession): Promise<INotification> {
		const notification = new this.model(notificationData);
		await notification.save({ session });
		return notification;
	}

	/**
	 * Get notifications for a user with pagination support
	 * @param userId - user publicId
	 * @param limit - number of notifications to fetch (default: 50)
	 * @param skip - number of notifications to skip for pagination (default: 0)
	 */
	async getNotifications(userId: string, limit: number = 50, skip: number = 0): Promise<INotification[]> {
		return this.model
			.find({ userId })
			.sort({ timestamp: -1 }) // most recent first
			.skip(skip)
			.limit(limit)
			.lean() // return plain JS objects for better performance
			.exec();
	}

	/**
	 * Get notifications older than a specific timestamp (cursor-based pagination)
	 * Used for infinite scroll - always returns older notifications than the cursor
	 * @param userId - user publicId
	 * @param beforeTimestamp - fetch notifications older than this timestamp
	 * @param limit - number of notifications to fetch (default: 20)
	 */
	async getNotificationsBeforeTimestamp(
		userId: string,
		beforeTimestamp: Date,
		limit: number = 20
	): Promise<INotification[]> {
		return this.model
			.find({
				userId,
				timestamp: { $lt: beforeTimestamp }, // older than cursor
			})
			.sort({ timestamp: -1 }) // most recent first (within the older set)
			.limit(limit)
			.lean()
			.exec();
	}

	/**
	 * Get count of unread notifications for a user
	 * Uses the compound index { userId: 1, isRead: 1 } for optimal performance
	 */
	async getUnreadCount(userId: string): Promise<number> {
		return this.model.countDocuments({ userId, isRead: false }).exec();
	}

	/**
	 * Mark a single notification as read
	 */
	async markAsRead(notificationId: string, userId: string) {
		if (!notificationId || !/^[0-9a-fA-F]{24}$/.test(notificationId)) {
			console.warn(`[NotificationRepository] Invalid notificationId format: ${notificationId}`);
			return null;
		}
		console.log(`[NotificationRepository] markAsRead start id=${notificationId} userId=${userId}`);
		try {
			const updated = await this.model
				.findOneAndUpdate({ _id: notificationId, userId }, { $set: { isRead: true } }, { new: true })
				.lean()
				.exec();
			if (!updated) {
				console.warn(
					`[NotificationRepository] markAsRead miss (not found or ownership mismatch) id=${notificationId} userId=${userId}`
				);
			} else {
				console.log(
					`[NotificationRepository] markAsRead success id=${notificationId} userId=${userId} isRead=${
						(updated as any).isRead
					}`
				);
			}
			return updated as any;
		} catch (e) {
			console.error(`[NotificationRepository] markAsRead error id=${notificationId} userId=${userId}:`, e);
			throw e;
		}
	}

	/**
	 * Mark all notifications as read for a user
	 * Useful for "mark all as read" functionality
	 */
	async markAllAsRead(userId: string): Promise<number> {
		const result = await this.model.updateMany({ userId, isRead: false }, { $set: { isRead: true } }).exec();
		return result.modifiedCount;
	}

	/**
	 * Delete old read notifications for a user (cleanup)
	 * @param userId - user publicId
	 * @param olderThanDays - delete notifications older than this many days (default: 30)
	 */
	async deleteOldReadNotifications(userId: string, olderThanDays: number = 30): Promise<number> {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

		const result = await this.model
			.deleteMany({
				userId,
				isRead: true,
				timestamp: { $lt: cutoffDate },
			})
			.exec();

		return result.deletedCount;
	}
}
