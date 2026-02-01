import { useQuery, useQueryClient } from "@tanstack/react-query";
import { searchQuery } from "../../api/searchApi";
import { mapPost } from "../../lib/mappers";

export const useSearch = (query: string) => {
	const queryClient = useQueryClient();

	const searchResults = useQuery({
		queryKey: ["query", query],
		queryFn: () => searchQuery(query),
		staleTime: 0,
		enabled: !!query, // run when query exists
		retry: 1,
		select: (data) => {
			return {
				...data,
				data: {
					...data.data,
					// Map the raw posts to the IPost interface
					posts: data.data.posts ? data.data.posts.map(mapPost) : [],
					users: data.data.users || [],
					communities: data.data.communities || [],
				},
			};
		},
	});

	const invalidateSearch = () => {
		queryClient.invalidateQueries({
			queryKey: ["query", query],
			exact: true,
		});
	};

	return { ...searchResults, invalidateSearch };
};
