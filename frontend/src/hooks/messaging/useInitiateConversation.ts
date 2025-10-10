import { useMutation, useQueryClient } from "@tanstack/react-query";
import { initiateConversation } from "../../api/messagingApi";
import { InitiateConversationResponse } from "@/types";

export function useInitiateConversation() {
	const queryClient = useQueryClient();

	return useMutation<InitiateConversationResponse, Error, string>({
		mutationFn: (recipientPublicId: string) => initiateConversation(recipientPublicId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["messaging", "conversations"], exact: false });
		},
	});
}
