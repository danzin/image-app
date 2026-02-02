import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../context/useSocket";
import { MessagingUpdatePayload, MessageDTO, ConversationMessagesResponse } from "../../types";
import type { InfiniteData } from "@tanstack/react-query";

function isMessagingUpdatePayload(value: unknown): value is MessagingUpdatePayload {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Partial<MessagingUpdatePayload>;
	return (
		(candidate.type === "message_sent" || candidate.type === "message_status_updated") &&
		typeof candidate.conversationId === "string" &&
		typeof candidate.timestamp === "string"
	);
}

export const useMessagingSocketIntegration = (): void => {
	const socket = useSocket();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!socket) return;

		const handleMessagingUpdate = (payload: unknown) => {
			if (!isMessagingUpdatePayload(payload)) return;

			const { conversationId, status } = payload;

			queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"], exact: false });
			if (conversationId) {
				if (payload.type === "message_status_updated" && status) {
					queryClient.setQueriesData<InfiniteData<ConversationMessagesResponse>>(
						{ queryKey: ["messaging", "conversation", conversationId], exact: false },
						(existing) => {
							if (!existing) return existing;

							const updatedPages = existing.pages.map((page) => ({
								...page,
								messages: page.messages.map((message: MessageDTO) => {
									if (message.status === "read") return message;
									if (status === "read") {
										return { ...message, status: "read" as const };
									}
									if (status === "delivered" && message.status === "sent") {
										return { ...message, status: "delivered" as const };
									}
									return message;
								}),
							}));

							return { ...existing, pages: updatedPages };
						},
					);
				}

				queryClient.invalidateQueries({
					predicate: (query) => {
						const key = query.queryKey;
						return (
							Array.isArray(key) && key[0] === "messaging" && key[1] === "conversation" && key[2] === conversationId
						);
					},
				});

				queryClient.refetchQueries({
					predicate: (query) => {
						const key = query.queryKey;
						return (
							Array.isArray(key) && key[0] === "messaging" && key[1] === "conversation" && key[2] === conversationId
						);
					},
					type: "active",
				});
			}
		};

		socket.on("messaging_update", handleMessagingUpdate);

		return () => {
			socket.off("messaging_update", handleMessagingUpdate);
		};
	}, [socket, queryClient]);
};
