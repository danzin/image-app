import { Document } from "mongoose";

export interface INotification extends Document {
	userId: string; // receiver publicId
	actionType: string; // like | follow | ...
	actorId: string; // actor publicId
	targetId?: string; // optional target publicId (e.g., image publicId)
	isRead: boolean;
	timestamp: Date;
}
