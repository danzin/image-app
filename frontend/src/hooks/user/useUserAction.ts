import { useMutation, useQuery, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { followUser, likeImage } from "../../api/userActions";
import { fetchIsFollowing } from "../../api/userApi";
import { IImage, PaginatedResponse } from "../../types";

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
		mutationFn: likeImage,
		onMutate: async (imagePublicId) => {
			console.log("Optimistic update for image:", imagePublicId);

			// Cancel all related queries
			await queryClient.cancelQueries({ queryKey: ["personalizedFeed"] });
			await queryClient.cancelQueries({ queryKey: ["image", imagePublicId] });
			await queryClient.cancelQueries({ queryKey: ["image"] }); // Cancel all image queries

			// Get current data
			const previousFeed = queryClient.getQueryData(["personalizedFeed"]);
			const previousImage = queryClient.getQueryData(["image", imagePublicId]);

			// Update individual image cache - toggle both likes count and isLikedByViewer
			queryClient.setQueryData(["image", imagePublicId], (oldImage: IImage) => {
				if (!oldImage) return oldImage;
				const currentlyLiked = oldImage.isLikedByViewer;
				return {
					...oldImage,
					likes: currentlyLiked ? oldImage.likes - 1 : oldImage.likes + 1,
					isLikedByViewer: !currentlyLiked,
				};
			});

			// Update the general image query (for useImageById)
			queryClient.setQueriesData({ queryKey: ["image"] }, (oldImage: IImage | undefined) => {
				if (!oldImage || oldImage.publicId !== imagePublicId) return oldImage;
				const currentlyLiked = oldImage.isLikedByViewer;
				return {
					...oldImage,
					likes: currentlyLiked ? oldImage.likes - 1 : oldImage.likes + 1,
					isLikedByViewer: !currentlyLiked,
				};
			});

			// Only update feed if it exists
			if (previousFeed) {
				queryClient.setQueryData(["personalizedFeed"], (oldData: PaginatedResponse | undefined) => {
					if (!oldData) return oldData;
					return {
						...oldData,
						pages: oldData.pages.map((page) => ({
							...page,
							data: page.data.map((image) => {
								if (image.publicId === imagePublicId) {
									const currentlyLiked = image.isLikedByViewer;
									return {
										...image,
										likes: currentlyLiked ? image.likes - 1 : image.likes + 1,
										isLikedByViewer: !currentlyLiked,
									};
								}
								return image;
							}),
						})),
					};
				});
			}

			return { previousFeed, previousImage, imagePublicId };
		},
		onError: (error, imagePublicId, context) => {
			if (context?.previousFeed) {
				queryClient.setQueryData(["personalizedFeed"], context.previousFeed);
			}
			if (context?.previousImage) {
				queryClient.setQueryData(["image", imagePublicId], context.previousImage);
			}
		},
		onSuccess: () => {
			// Invalidate all image-related queries to get fresh data
			queryClient.invalidateQueries({ queryKey: ["image"] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
			queryClient.invalidateQueries({ queryKey: ["images"] });
		},
		onSettled: () => {
			// Additional invalidation as fallback
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
			queryClient.invalidateQueries({ queryKey: ["images"] });
			queryClient.invalidateQueries({ queryKey: ["image"] });
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
