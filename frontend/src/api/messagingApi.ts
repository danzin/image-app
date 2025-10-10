import axiosClient from "./axiosClient";
import {
	SendMessageRequest,
	MessageDTO,
	InitiateConversationResponse,
	ConversationListResponse,
	ConversationMessagesResponse,
} from "@/types";

export const fetchConversations = async (
	params: { page?: number; limit?: number } = {}
): Promise<ConversationListResponse> => {
	const { page = 1, limit = 20 } = params;
	const { data } = await axiosClient.get("/api/messaging/conversations", {
		params: { page, limit },
	});
	return data;
};

export const fetchConversationMessages = async (
	conversationPublicId: string,
	params: { page?: number; limit?: number } = {}
): Promise<ConversationMessagesResponse> => {
	const { page = 1, limit = 30 } = params;
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

export const initiateConversation = async (recipientPublicId: string): Promise<InitiateConversationResponse> => {
	const { data } = await axiosClient.post("/api/messaging/conversations/initiate", {
		recipientPublicId,
	});
	return data;
};
