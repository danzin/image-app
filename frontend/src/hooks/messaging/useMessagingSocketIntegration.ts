import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../context/useSocket";
import { MessagingUpdatePayload } from "../../types";

function isMessagingUpdatePayload(value: unknown): value is MessagingUpdatePayload {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const candidate = value as Partial<MessagingUpdatePayload>;
	return (
		candidate.type === "message_sent" &&
		typeof candidate.conversationId === "string" &&
		typeof candidate.senderId === "string" &&
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

			const { conversationId } = payload;

			queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"], exact: false });
			if (conversationId) {
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
