import { useMutation, useQuery, useQueryClient, UseQueryOptions, InfiniteData } from "@tanstack/react-query";
import { followUser, likePost } from "../../api/userActions";
import { fetchIsFollowing } from "../../api/userApi";
import {
	IImage,
	ImagePageData,
	PaginatedResponse,
	PublicUserDTO,
	AuthenticatedUserDTO,
	AdminUserDTO,
	WhoToFollowResponse,
} from "../../types";

// Hook to follow a user by public ID
export const useFollowUser = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: followUser,
		onMutate: async (publicId) => {
			const userEntries = queryClient.getQueriesData<PublicUserDTO>({ queryKey: ["user"] });
			const whoToFollowEntries = queryClient.getQueriesData<WhoToFollowResponse>({ queryKey: ["whoToFollow"] });
			await Promise.all([
				queryClient.cancelQueries({ queryKey: ["isFollowing", publicId], exact: true }),
				queryClient.cancelQueries({ queryKey: ["userPosts", publicId], exact: true }),
				queryClient.cancelQueries({ queryKey: ["currentUser"], exact: true }),
				...userEntries.map(([key]) => queryClient.cancelQueries({ queryKey: key })),
				...whoToFollowEntries.map(([key]) => queryClient.cancelQueries({ queryKey: key })),
			]);

			const previousIsFollowing = queryClient.getQueryData<boolean>(["isFollowing", publicId]);
			const previousUserPosts = queryClient.getQueryData<InfiniteData<ImagePageData>>(["userPosts", publicId]);
			const previousCurrentUser = queryClient.getQueryData<AuthenticatedUserDTO | AdminUserDTO>(["currentUser"]);

			const wasFollowing = previousIsFollowing ?? false;
			const delta = wasFollowing ? -1 : 1;
			const nextIsFollowing = !wasFollowing;

			queryClient.setQueryData(["isFollowing", publicId], nextIsFollowing);

			userEntries.forEach(([key, data]) => {
				if (!data || data.publicId !== publicId) {
					return;
				}
				queryClient.setQueryData<PublicUserDTO>(key, {
					...data,
					followerCount: Math.max(0, (data.followerCount ?? 0) + delta),
				});
			});

			if (previousUserPosts) {
				const updatedPages = previousUserPosts.pages.map((page) => {
					if (!page?.profile || page.profile.publicId !== publicId) {
						return page;
					}
					return {
						...page,
						profile: {
							...page.profile,
							followerCount: Math.max(0, (page.profile.followerCount ?? 0) + delta),
						},
					};
				});
				queryClient.setQueryData<InfiniteData<ImagePageData>>(["userPosts", publicId], {
					...previousUserPosts,
					pages: updatedPages,
				});
			}

			if (previousCurrentUser) {
				queryClient.setQueryData<AuthenticatedUserDTO | AdminUserDTO>(["currentUser"], {
					...previousCurrentUser,
					followingCount: Math.max(0, (previousCurrentUser.followingCount ?? 0) + delta),
				});
			}

			whoToFollowEntries.forEach(([key, data]) => {
				if (!data) {
					return;
				}
				if (delta > 0) {
					const filtered = data.suggestions.filter((suggestion) => suggestion.publicId !== publicId);
					queryClient.setQueryData<WhoToFollowResponse>(key, {
						...data,
						suggestions: filtered,
					});
				} else if (delta < 0) {
					const suggestions = data.suggestions.map((suggestion) =>
						suggestion.publicId === publicId
							? { ...suggestion, followerCount: Math.max(0, (suggestion.followerCount ?? 0) + delta) }
							: suggestion
					);
					queryClient.setQueryData<WhoToFollowResponse>(key, {
						...data,
						suggestions,
					});
				}
			});

			return {
				previousIsFollowing,
				previousUserEntries: userEntries,
				previousUserPosts,
				previousCurrentUser,
				previousWhoToFollowEntries: whoToFollowEntries,
				publicId,
			};
		},
		onSuccess: (_data, publicId) => {
			queryClient.invalidateQueries({ queryKey: ["isFollowing", publicId], exact: true, refetchType: "active" });
			queryClient.invalidateQueries({
				queryKey: ["user"],
				refetchType: "inactive",
				predicate: (query) => {
					const cached = query.state.data as PublicUserDTO | AuthenticatedUserDTO | AdminUserDTO | undefined;
					return cached?.publicId === publicId;
				},
			});
			queryClient.invalidateQueries({ queryKey: ["userPosts", publicId], exact: true, refetchType: "inactive" });
			queryClient.invalidateQueries({ queryKey: ["currentUser"], exact: true, refetchType: "inactive" });
			queryClient.invalidateQueries({ queryKey: ["whoToFollow"], refetchType: "active" });
		},
		onError: (error: Error, publicId, context) => {
			console.error("Error following user:", error.message || error);
			if (!context) {
				return;
			}
			queryClient.setQueryData(["isFollowing", publicId], context.previousIsFollowing);
			context.previousUserEntries.forEach(([key, data]) => {
				queryClient.setQueryData(key, data);
			});
			if (context.previousUserPosts) {
				queryClient.setQueryData(["userPosts", publicId], context.previousUserPosts);
			}
			if (context.previousCurrentUser !== undefined) {
				queryClient.setQueryData(["currentUser"], context.previousCurrentUser);
			}
			context.previousWhoToFollowEntries.forEach(([key, data]) => {
				queryClient.setQueryData(key, data);
			});
		},
	});
};

// Hook to like a post by public ID
export const useLikePost = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: likePost,
		onMutate: async (postPublicId) => {
			console.log("Optimistic update for post:", postPublicId);

			// Cancel all related queries (both image and post queries)
			await queryClient.cancelQueries({ queryKey: ["personalizedFeed"] });
			await queryClient.cancelQueries({ queryKey: ["image", postPublicId] });
			await queryClient.cancelQueries({ queryKey: ["image"] });
			await queryClient.cancelQueries({ queryKey: ["post", postPublicId] });
			await queryClient.cancelQueries({ queryKey: ["posts"] });

			// Get current data
			const previousFeed = queryClient.getQueryData<InfiniteData<PaginatedResponse<IImage>>>(["personalizedFeed"]);
			const previousImage = queryClient.getQueryData<IImage>(["image", postPublicId]);
			const previousPost = queryClient.getQueryData<IImage>(["post", postPublicId]);

			// Update individual image cache - toggle both likes count and isLikedByViewer
			queryClient.setQueryData<IImage>(["image", postPublicId], (oldImage) => {
				if (!oldImage) return oldImage;
				const currentlyLiked = oldImage.isLikedByViewer;
				return {
					...oldImage,
					likes: currentlyLiked ? oldImage.likes - 1 : oldImage.likes + 1,
					isLikedByViewer: !currentlyLiked,
				};
			});

			// Update individual post cache - toggle both likes count and isLikedByViewer
			queryClient.setQueryData<IImage>(["post", postPublicId], (oldPost) => {
				if (!oldPost) return oldPost;
				const currentlyLiked = oldPost.isLikedByViewer;
				return {
					...oldPost,
					likes: currentlyLiked ? oldPost.likes - 1 : oldPost.likes + 1,
					isLikedByViewer: !currentlyLiked,
				};
			});

			// Update the general image query (for useImageById)
			queryClient.setQueriesData<IImage>({ queryKey: ["image"] }, (oldImage) => {
				if (!oldImage || oldImage.publicId !== postPublicId) return oldImage;
				const currentlyLiked = oldImage.isLikedByViewer;
				return {
					...oldImage,
					likes: currentlyLiked ? oldImage.likes - 1 : oldImage.likes + 1,
					isLikedByViewer: !currentlyLiked,
				};
			});

			// Update all post queries
			queryClient.setQueriesData<IImage>({ queryKey: ["posts"] }, (oldPost) => {
				if (!oldPost || oldPost.publicId !== postPublicId) return oldPost;
				const currentlyLiked = oldPost.isLikedByViewer;
				return {
					...oldPost,
					likes: currentlyLiked ? oldPost.likes - 1 : oldPost.likes + 1,
					isLikedByViewer: !currentlyLiked,
				};
			});

			// only update feed if it exists
			if (previousFeed) {
				queryClient.setQueryData<InfiniteData<PaginatedResponse<IImage>>>(["personalizedFeed"], (oldData) => {
					if (!oldData) return oldData;
					return {
						...oldData,
						pages: oldData.pages.map((page) => ({
							...page,
							data: page.data.map((image) => {
								if (image.publicId === postPublicId) {
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

			return { previousFeed, previousImage, previousPost, postPublicId };
		},
		onError: (error, postPublicId, context) => {
			// Rollback optimistic updates on error
			if (context?.previousFeed) {
				queryClient.setQueryData(["personalizedFeed"], context.previousFeed);
			}
			if (context?.previousImage) {
				queryClient.setQueryData(["image", postPublicId], context.previousImage);
			}
			if (context?.previousPost) {
				queryClient.setQueryData(["post", postPublicId], context.previousPost);
			}
		},
		onSuccess: () => {
			// trust the optimistic update
			// only invalidate feed queries in background to sync other posts
			setTimeout(() => {
				queryClient.invalidateQueries({
					queryKey: ["personalizedFeed"],
					refetchType: "none", // Don't refetch immediately
				});
				queryClient.invalidateQueries({
					queryKey: ["trendingFeed"],
					refetchType: "none",
				});
				queryClient.invalidateQueries({
					queryKey: ["newFeed"],
					refetchType: "none",
				});
				queryClient.invalidateQueries({
					queryKey: ["forYouFeed"],
					refetchType: "none",
				});
			}, 1000);
		},
		onSettled: () => {
			// The backend will return correct state on next natural refetch
		},
	});
};

// Legacy alias for backward compatibility
export const useLikeImage = useLikePost;

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
