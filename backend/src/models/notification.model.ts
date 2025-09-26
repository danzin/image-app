import mongoose, { Schema } from "mongoose";
import { INotification } from "../types";

const notificationSchema = new Schema<INotification>({
	userId: { type: String, required: true }, // receiver publicId
	actionType: { type: String, required: true },
	actorId: { type: String, required: true }, // actor publicId
	actorUsername: { type: String }, // denormalized for quick display
	targetId: { type: String }, // optional target publicId
	isRead: { type: Boolean, default: false },
	timestamp: { type: Date, default: Date.now },
});

const Notification = mongoose.model<INotification>("Notification", notificationSchema);
export default Notification;
