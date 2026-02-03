import { useQuery } from "@tanstack/react-query";
import { fetchHandleSuggestions } from "../../api/userApi";
import { HandleSuggestionContext, HandleSuggestionResponse } from "../../types";

export const useHandleSuggestions = (
	query: string,
	context: HandleSuggestionContext,
	limit: number = 8,
	enabled: boolean = true,
) => {
	return useQuery<HandleSuggestionResponse>({
		queryKey: ["handleSuggestions", context, query, limit],
		queryFn: () => fetchHandleSuggestions(query, context, limit),
		enabled: enabled,
		staleTime: 30000,
		refetchOnWindowFocus: false,
	});
};
