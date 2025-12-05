import { useQuery } from "@tanstack/react-query";
import { fetchWhoToFollow } from "../../api/userApi";
import { WhoToFollowResponse } from "@/types";

export const useWhoToFollow = (limit: number = 5) => {
	return useQuery<WhoToFollowResponse>({
		queryKey: ["whoToFollow", limit],
		queryFn: () => fetchWhoToFollow(limit),
		staleTime: 60000,
		gcTime: 1800000, // garbage collection time, 30 minutes
		retry: 1,
		refetchOnWindowFocus: false,
	});
};
