import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchPostsByCommunity } from "../../api/postApi";
import { mapPost } from "../../lib/mappers";
import { IPost } from "../../types";

export const useCommunityPosts = (communityId?: string) => {
	return useInfiniteQuery({
		queryKey: ["community-posts", communityId],
		queryFn: async ({ pageParam = 1 }) => {
			if (!communityId) throw new Error("Community ID is required");
			const response = await fetchPostsByCommunity(communityId, pageParam);

			const mappedData = response.data.map((rawPost: IPost) => mapPost(rawPost));

			return {
				...response,
				data: mappedData,
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled: !!communityId,
	});
};
