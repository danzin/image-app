import { InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { markConversationRead } from "../../api/messagingApi";
import type { ConversationListResponse } from "../../types";

export function useMarkConversationRead() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (conversationPublicId: string) => markConversationRead(conversationPublicId),

		onSuccess: (_data, conversationPublicId) => {
			// manually update the cache for the conversation list without invalidating
			// this prevents refetching and breaking the infinite loop
			queryClient.setQueriesData<InfiniteData<ConversationListResponse>>(
				{ queryKey: ["messaging", "conversations"], exact: false },
				(oldData) => {
					if (!oldData) return oldData;

					return {
						...oldData,
						pages: oldData.pages.map((page) => ({
							...page,
							conversations: page.conversations.map((convo) => {
								if (convo.publicId === conversationPublicId) {
									return { ...convo, unreadCount: 0 };
								}
								return convo;
							}),
						})),
					};
				}
			);
		},
	});
}
