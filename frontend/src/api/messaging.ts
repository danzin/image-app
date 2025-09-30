import axiosClient from "./axiosClient";
import { ConversationSummaryDTO, MessageDTO, MessageAttachment } from "../types";

export interface ConversationListResponse {
	conversations: ConversationSummaryDTO[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface ConversationMessagesResponse {
	messages: MessageDTO[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export interface SendMessageRequest {
	conversationPublicId?: string;
	recipientPublicId?: string;
	body: string;
	attachments?: MessageAttachment[];
}

export const fetchConversations = async (page = 1, limit = 20): Promise<ConversationListResponse> => {
	const { data } = await axiosClient.get("/api/messaging/conversations", {
		params: { page, limit },
	});
	return data;
};

export const fetchConversationMessages = async (
	conversationPublicId: string,
	page = 1,
	limit = 30
): Promise<ConversationMessagesResponse> => {
	const { data } = await axiosClient.get(`/api/messaging/conversations/${conversationPublicId}/messages`, {
		params: { page, limit },
	});
	return data;
};

export const markConversationRead = async (conversationPublicId: string): Promise<void> => {
	await axiosClient.post(`/api/messaging/conversations/${conversationPublicId}/read`);
};

export const sendMessage = async (payload: SendMessageRequest): Promise<{ message: MessageDTO }> => {
	const { data } = await axiosClient.post("/api/messaging/messages", payload);
	return data;
};
