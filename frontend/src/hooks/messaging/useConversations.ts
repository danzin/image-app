import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchConversations } from "../../api/messagingApi";
import { ConversationListResponse } from "@/types";

const DEFAULT_PAGE_SIZE = 20;

export function useConversations(limit: number = DEFAULT_PAGE_SIZE) {
	return useInfiniteQuery<ConversationListResponse>({
		queryKey: ["messaging", "conversations", limit],
		initialPageParam: 1,
		getNextPageParam: (lastPage) => {
			const nextPage = lastPage.page + 1;
			return nextPage <= lastPage.totalPages ? nextPage : undefined;
		},
		queryFn: ({ pageParam }) => fetchConversations({ page: (pageParam as number) ?? 1, limit }),
	});
}
