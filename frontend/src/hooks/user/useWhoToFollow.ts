import { useQuery } from "@tanstack/react-query";
import { fetchWhoToFollow } from "../../api/userApi";
import { WhoToFollowResponse } from "@/types";

export const useWhoToFollow = (limit: number = 5) => {
	return useQuery<WhoToFollowResponse>({
		queryKey: ["whoToFollow", limit],
		queryFn: () => fetchWhoToFollow(limit),
		staleTime: 1800000, // 30 minutes in milliseconds
		gcTime: 1800000, // garbage collection time, also 30 minutes
		retry: 1,
		refetchOnWindowFocus: false,
	});
};
