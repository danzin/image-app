import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchCommunities, fetchUserCommunities } from "../../api/communityApi";

export const useCommunities = () => {
	return useInfiniteQuery({
		queryKey: ["communities"],
		queryFn: ({ pageParam = 1 }) => fetchCommunities(pageParam),
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
	});
};

export const useUserCommunities = (enabled: boolean = true) => {
	return useInfiniteQuery({
		queryKey: ["user-communities"],
		queryFn: ({ pageParam = 1 }) => fetchUserCommunities(pageParam),
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled,
	});
};
