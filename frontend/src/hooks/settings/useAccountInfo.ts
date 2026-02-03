import { useQuery } from "@tanstack/react-query";
import { fetchAccountInfo } from "../../api/userApi";
import { AccountInfoDTO } from "../../types";

export const useAccountInfo = () => {
	return useQuery<AccountInfoDTO>({
		queryKey: ["accountInfo"],
		queryFn: fetchAccountInfo,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});
};
