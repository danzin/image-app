import { Document } from "mongoose";

export interface INotification extends Document {
	userId: string; // receiver publicId
	actionType: string; // like | comment | follow | message | mention
	actorId: string; // actor publicId
	actorUsername?: string; // optional, provided by frontend or resolved from actorId
	actorAvatar?: string; // actor avatar URL for quick display
	targetId?: string; // optional target publicId (e.g., post publicId, image publicId)
	targetType?: string; // 'post' | 'image' | 'user'
	targetPreview?: string; // preview text/snippet of the target content
	isRead: boolean;
	timestamp: Date;
}
