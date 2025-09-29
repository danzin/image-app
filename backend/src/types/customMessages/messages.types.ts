import mongoose, { Document } from "mongoose";

export type MessageStatus = "sent" | "delivered" | "read";

export interface IMessageAttachment {
	url: string;
	type: string;
	mimeType?: string;
	thumbnailUrl?: string;
}

export interface IMessage extends Document {
	publicId: string;
	conversation: mongoose.Types.ObjectId;
	sender: mongoose.Types.ObjectId;
	body: string;
	attachments?: IMessageAttachment[];
	status: MessageStatus;
	readBy: mongoose.Types.ObjectId[];
	createdAt: Date;
	updatedAt: Date;
}

export interface IConversation extends Document {
	publicId: string;
	participantHash: string;
	participants: mongoose.Types.ObjectId[];
	lastMessage?: mongoose.Types.ObjectId;
	lastMessageAt?: Date;
	unreadCounts: Map<string, number>;
	isGroup: boolean;
	title?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface MessageCreateInput {
	conversationId: string;
	senderId: string;
	body: string;
	attachments?: IMessageAttachment[];
}

export interface SendMessagePayload {
	conversationPublicId?: string;
	recipientPublicId?: string;
	body: string;
}

export interface MessageDTO {
	publicId: string;
	conversationId: string;
	body: string;
	sender: {
		publicId: string;
		username: string;
		avatar: string;
	};
	attachments: IMessageAttachment[];
	status: MessageStatus;
	createdAt: string;
	readBy: string[];
}

export interface ConversationParticipantDTO {
	publicId: string;
	username: string;
	avatar: string;
}

export interface ConversationSummaryDTO {
	publicId: string;
	participants: ConversationParticipantDTO[];
	lastMessage?: MessageDTO | null;
	lastMessageAt?: string | null;
	unreadCount: number;
	isGroup: boolean;
	title?: string;
}
