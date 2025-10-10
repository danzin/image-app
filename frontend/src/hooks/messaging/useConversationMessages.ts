import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchConversationMessages } from "../../api/messagingApi";
import { ConversationMessagesResponse } from "@/types";

const DEFAULT_PAGE_SIZE = 30;

export function useConversationMessages(conversationPublicId: string | null, limit: number = DEFAULT_PAGE_SIZE) {
	return useInfiniteQuery<ConversationMessagesResponse>({
		queryKey: ["messaging", "conversation", conversationPublicId, limit],
		enabled: Boolean(conversationPublicId),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const nextPage = lastPage.page + 1;
			return nextPage <= lastPage.totalPages ? nextPage : undefined;
		},
		queryFn: ({ pageParam }) =>
			fetchConversationMessages(conversationPublicId as string, { page: (pageParam as number) ?? 1, limit }),
	});
}
