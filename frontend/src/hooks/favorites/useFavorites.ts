import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchUserFavorites } from "../../api/favorites";
import { mapImage } from "../../lib/mappers";
import { useAuth } from "../context/useAuth";
import { IImage } from "../../types";

interface FavoritesPage {
	data: IImage[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export const useFavorites = (options?: { limit?: number }) => {
	const { isLoggedIn } = useAuth();
	const pageSize = options?.limit ?? 12;

	return useInfiniteQuery<FavoritesPage, Error>({
		queryKey: ["favorites", "user"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchUserFavorites(pageParam as number, pageSize);
			return {
				...response,
				data: response.data.map((raw) => mapImage(raw)),
			};
		},
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		initialPageParam: 1,
		enabled: isLoggedIn,
		staleTime: 0,
		refetchOnWindowFocus: false,
	});
};
