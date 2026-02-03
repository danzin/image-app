import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteMessage } from "../../api/messagingApi";

export function useDeleteMessage() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ messageId }: { messageId: string; conversationId: string }) => deleteMessage(messageId),
		onSuccess: (_data, variables) => {
             queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"], exact: false });
			 if (variables.conversationId) {
				queryClient.invalidateQueries({
					queryKey: ["messaging", "conversation", variables.conversationId],
					exact: false
				});
			 }
		},
	});
}
