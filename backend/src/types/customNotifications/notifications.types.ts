import { Document } from "mongoose";

export interface INotification extends Document {
	userId: string; // receiver publicId
	actionType: string; // like | follow | ...
	actorId: string; // actor publicId
	actorUsername?: string; // optional, provided by frontend or resolved from actorId
	targetId?: string; // optional target publicId (e.g., image publicId)
	isRead: boolean;
	timestamp: Date;
}
