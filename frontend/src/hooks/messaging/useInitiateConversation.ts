import { useMutation, useQueryClient } from "@tanstack/react-query";
import { initiateConversation, InitiateConversationResponse } from "../../api/messagingApi";

export function useInitiateConversation() {
	const queryClient = useQueryClient();

	return useMutation<InitiateConversationResponse, Error, string>({
		mutationFn: (recipientPublicId: string) => initiateConversation(recipientPublicId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"], exact: false });
		},
	});
}
