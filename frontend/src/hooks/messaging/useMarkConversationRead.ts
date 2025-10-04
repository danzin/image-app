import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markConversationRead } from "../../api/messagingApi";

export function useMarkConversationRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (conversationPublicId: string) => markConversationRead(conversationPublicId),
		onSuccess: (_data, conversationPublicId) => {
			queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"] });
			queryClient.invalidateQueries({ queryKey: ["messaging", "conversation", conversationPublicId] });
		},
	});
}
