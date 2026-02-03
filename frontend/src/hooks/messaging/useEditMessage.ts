import { useMutation, useQueryClient } from "@tanstack/react-query";
import { editMessage } from "../../api/messagingApi";

export function useEditMessage() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ messageId, body }: { messageId: string; body: string }) => editMessage(messageId, body),
		onSuccess: (data) => {
			const conversationId = data.message.conversationId;
             // Optionally invalidate queries
             queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"], exact: false });
			 if (conversationId) {
				queryClient.invalidateQueries({
					queryKey: ["messaging", "conversation", conversationId],
					exact: false
				});
			 }
		},
	});
}
