import { useMutation, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { followUser, likeImage } from "../../api/userActions";
import { fetchIsFollowing } from "../../api/userApi";
import { PaginatedResponse } from "../../types";

// Hook to follow a user by public ID
export const useFollowUser = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: followUser,
		onSuccess: (_data, publicId) => {
			// Invalidate query for isFollowing using public ID
			queryClient.invalidateQueries({ queryKey: ["isFollowing", publicId] });
			// Invalidate user-related queries
			queryClient.invalidateQueries({ queryKey: ["user"] });
			queryClient.invalidateQueries({ queryKey: ["currentUser"] });
		},
		onError: (error: Error) => {
			console.error("Error following user:", error.message || error);
		},
	});
};

// Hook to like an image by public ID
export const useLikeImage = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: likeImage, // Calls API to like/unlike using image public ID
		onSuccess: (updatedImage) => {
			// Invalidate queries using public ID
			queryClient.invalidateQueries({
				queryKey: ["image", updatedImage.publicId],
			});

			// Update personalized feed cache
			queryClient.setQueryData(["personalizedFeed"], (oldData: PaginatedResponse | undefined) => {
				if (!oldData) return oldData;

				return {
					...oldData,
					pages: oldData.pages.map((page) => ({
						...page,
						data: page.data.map((image) => (image.publicId === updatedImage.publicId ? updatedImage : image)),
					})),
				};
			});

			// Also invalidate regular images feed
			queryClient.invalidateQueries({ queryKey: ["images"] });
		},

		onError: (error) => {
			console.error("Error liking image:", error);
		},
	});
};

// Hook checking if current logged in user is following the profile they're visiting (by public ID)
export const useIsFollowing = (
	publicId: string,
	options?: Omit<UseQueryOptions<boolean, Error, boolean>, "queryKey" | "queryFn">
) => {
	return useQuery({
		queryKey: ["isFollowing", publicId],
		queryFn: () => fetchIsFollowing({ queryKey: ["isFollowing", publicId] }),
		staleTime: 6000,
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		enabled: !!publicId, // Only run if publicId is provided
		...options,
	});
};
