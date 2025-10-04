import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "../../api/userApi";
import { IUser } from "../../types";

export const useCurrentUser = () => {
	return useQuery<IUser>({
		queryKey: ["currentUser"],
		queryFn: ({ signal }) => fetchCurrentUser(signal),
		retry: false,
		refetchOnWindowFocus: true,
		staleTime: 30000, // 30 seconds
	});
};
