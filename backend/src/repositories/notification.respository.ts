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
			.populate("actorId", "username") //populate the actor id field with username
			.sort({ timestamp: -1 })
			.exec();
	}

	async markAsRead(notificationId: string) {
		return this.model.findByIdAndUpdate(notificationId, { $set: { isRead: true } }, { new: true });
	}
}
