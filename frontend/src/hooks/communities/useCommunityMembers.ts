import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchCommunityMembers } from "../../api/communityApi";

export const useCommunityMembers = (slug?: string) => {
	return useInfiniteQuery({
		queryKey: ["community-members", slug],
		queryFn: async ({ pageParam = 1 }) => {
			if (!slug) throw new Error("Community slug is required");
			return fetchCommunityMembers(slug, pageParam);
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled: !!slug,
	});
};
