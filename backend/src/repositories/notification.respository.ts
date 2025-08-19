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

	async getNotifications(userId: string) {
		return this.model
			.find({ userId, isRead: false }) //fetch unread notifications by receiver publicId
			.sort({ timestamp: -1 })
			.exec();
	}

	async markAsRead(notificationId: string, userId: string) {
		if (!notificationId || !/^[0-9a-fA-F]{24}$/.test(notificationId)) {
			console.warn(`[NotificationRepository] Invalid notificationId format: ${notificationId}`);
			return null;
		}
		console.log(`[NotificationRepository] markAsRead start id=${notificationId} userId=${userId}`);
		try {
			const updated = await this.model
				.findOneAndUpdate({ _id: notificationId, userId }, { $set: { isRead: true } }, { new: true })
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
}
