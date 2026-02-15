import { useInfiniteQuery, useMutation, useQuery, useQueryClient, InfiniteData } from "@tanstack/react-query";
import {
	fetchPosts,
	fetchPostByPublicId,
	fetchPostBySlug,
	uploadPost,
	fetchTags,
	fetchPostsByTag,
	deletePostByPublicId,
	fetchPersonalizedFeed,
	fetchTrendingFeed,
	fetchNewFeed,
	fetchForYouFeed,
	repostPost,
} from "../../api/postApi";
import { IPost, ITag, PaginatedResponse } from "../../types";
import { useAuth } from "../context/useAuth";
import { mapPost } from "../../lib/mappers";

export const usePosts = () => {
	const { user } = useAuth();

	const queryKey = ["posts", user?.publicId];

	return useInfiniteQuery<
		PaginatedResponse<IPost>,
		Error
	>({
		queryKey,
		queryFn: async ({ pageParam = 1 }) => {
			// fetchPosts (user feed) still uses numeric page, fetchNewFeed can use cursor
			const response = !user 
				? await fetchNewFeed(pageParam as number | string, 10) 
				: await fetchPosts(pageParam as number, 10);

			return {
				...response,
				data: response.data.map((rawPost: IPost) => mapPost(rawPost)),
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.nextCursor) return lastPage.nextCursor;
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: true,
	});
};

export const usePostByPublicId = (publicId: string) => {
	const { user } = useAuth();

	return useQuery<IPost, Error>({
		queryKey: ["post", "publicId", publicId, user?.publicId],
		queryFn: async () => {
			const rawPost = await fetchPostByPublicId(publicId);
			return mapPost(rawPost);
		},
		enabled: !!publicId,
		staleTime: 0,
		refetchOnMount: true,
	});
};

export const usePostBySlug = (slug: string) => {
	return useQuery<IPost, Error>({
		queryKey: ["post", "slug", slug],
		queryFn: async () => {
			const rawPost = await fetchPostBySlug(slug);
			return mapPost(rawPost);
		},
		enabled: !!slug,
		staleTime: 0,
		refetchOnMount: true,
	});
};

export const usePostById = (identifier: string) => {
	// Strip file extension
	const cleanIdentifier = identifier ? identifier.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "") : identifier;

	return useQuery<IPost, Error>({
		queryKey: ["post", cleanIdentifier],
		queryFn: async () => {
			const rawPost = await fetchPostByPublicId(cleanIdentifier);
			const mappedPost = mapPost(rawPost);
			return mappedPost;
		},
		enabled: !!identifier,
		staleTime: 0,
		refetchOnMount: true,
	});
};

export const usePostsByTag = (
	tags: string[],
	options?: {
		limit?: number;
		enabled?: boolean;
	}
) => {
	const limit = options?.limit ?? 10;
	const enabled = options?.enabled ?? tags.length > 0;

	return useInfiniteQuery<
		{
			data: IPost[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		},
		Error
	>({
		queryKey: ["postsByTag", tags],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchPostsByTag({ tags, page: pageParam as number, limit });
			return {
				...response,
				data: response.data.map((rawPost: IPost) => mapPost(rawPost)),
			};
		},
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		initialPageParam: 1,
		enabled,
		staleTime: 0,
		refetchOnMount: true,
		...options,
	});
};

export const useTags = () => {
	return useQuery<ITag[], Error>({
		queryKey: ["tags"],
		queryFn: fetchTags,
		staleTime: 0,
		refetchOnMount: true,
	});
};

export const useUploadPost = () => {
	const queryClient = useQueryClient();

	return useMutation<IPost, Error, FormData>({
		mutationFn: uploadPost,
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
			await queryClient.refetchQueries({ queryKey: ["currentUser"] });

			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["post"] });
			queryClient.invalidateQueries({ queryKey: ["user"] });
			queryClient.invalidateQueries({ queryKey: ["userPosts"] });
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
			queryClient.invalidateQueries({ queryKey: ["community-posts"] });

			queryClient.refetchQueries({ queryKey: ["posts"], type: "active" });
			queryClient.refetchQueries({ queryKey: ["personalizedFeed"], type: "active" });
			queryClient.refetchQueries({ queryKey: ["community-posts"], type: "active" });
		},
		onError: (error: Error) => {
			console.error("Error uploading post:", error);
		},
	});
};

export const useDeletePost = () => {
	const queryClient = useQueryClient();

	return useMutation<void, Error, string>({
		mutationFn: deletePostByPublicId,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["post"] });
			queryClient.invalidateQueries({ queryKey: ["user"] });
			queryClient.invalidateQueries({ queryKey: ["userPosts"] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
		},
		onError: (error: Error) => {
			console.error("Error deleting post:", error);
		},
	});
};

export const useRepostPost = () => {
	const queryClient = useQueryClient();

	return useMutation<IPost, Error, { postPublicId: string; body?: string }>({
		mutationFn: ({ postPublicId, body }) => repostPost(postPublicId, body),
		onSuccess: (_newPost, { postPublicId }) => {
			const bumpRepostCountInInfinite = (key: unknown[]) => {
				queryClient.setQueriesData<
					InfiniteData<{
						data: IPost[];
						total: number;
						page: number;
						limit: number;
						totalPages: number;
					}>
				>({ queryKey: key }, (existing) => {
					if (!existing) return existing;
					return {
						...existing,
						pages: existing.pages.map((page) => ({
							...page,
							data: page.data.map((post) =>
								post.publicId === postPublicId ? { ...post, repostCount: (post.repostCount || 0) + 1 } : post
							),
						})),
					};
				});
			};

			queryClient.setQueriesData<IPost>({ queryKey: ["post", "publicId", postPublicId] }, (existing) =>
				existing ? { ...existing, repostCount: (existing.repostCount || 0) + 1 } : existing
			);
			queryClient.setQueriesData<IPost>({ queryKey: ["post", postPublicId] }, (existing) =>
				existing ? { ...existing, repostCount: (existing.repostCount || 0) + 1 } : existing
			);

			bumpRepostCountInInfinite(["posts"]);
			bumpRepostCountInInfinite(["personalizedFeed"]);
			bumpRepostCountInInfinite(["trendingFeed"]);
			bumpRepostCountInInfinite(["newFeed"]);
			bumpRepostCountInInfinite(["forYouFeed"]);
			bumpRepostCountInInfinite(["postsByTag"]);

			queryClient.invalidateQueries({ queryKey: ["post", "publicId", postPublicId] });
			queryClient.invalidateQueries({ queryKey: ["post", postPublicId] });

			// Invalidate feeds to show the new repost
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
			queryClient.invalidateQueries({ queryKey: ["newFeed"] });
			queryClient.invalidateQueries({ queryKey: ["forYouFeed"] });
			queryClient.invalidateQueries({ queryKey: ["userPosts"] });
		},
		onError: (error: Error) => {
			console.error("Error reposting post:", error);
		},
	});
};

export const usePersonalizedFeed = (options?: { enabled?: boolean; limit?: number }) => {
	const { isLoggedIn } = useAuth();
	const enabled = options?.enabled ?? isLoggedIn;
	const limit = options?.limit ?? 5;

	return useInfiniteQuery<
		PaginatedResponse<IPost>,
		Error
	>({
		queryKey: ["personalizedFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchPersonalizedFeed(pageParam as number | string, limit);
			return {
				...response,
				data: response.data.map((rawPost: IPost) => mapPost(rawPost)),
			};
		},
		getNextPageParam: (lastPage) => (lastPage.nextCursor ? lastPage.nextCursor : lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		initialPageParam: 1,
		enabled,
		staleTime: 0,
	});
};

export const useTrendingFeed = (options?: { enabled?: boolean; limit?: number }) => {
	const enabled = options?.enabled ?? true;
	const limit = options?.limit ?? 10;

	return useInfiniteQuery<
		PaginatedResponse<IPost>,
		Error
	>({
		queryKey: ["trendingFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchTrendingFeed(pageParam as number | string, limit);
			return {
				...response,
				data: response.data.map(mapPost),
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.nextCursor) return lastPage.nextCursor;
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled,
		staleTime: 2 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
};

export const useNewFeed = (options?: { enabled?: boolean; limit?: number }) => {
	const enabled = options?.enabled ?? true;
	const limit = options?.limit ?? 10;

	const query = useInfiniteQuery<
		PaginatedResponse<IPost>,
		Error
	>({
		queryKey: ["newFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchNewFeed(pageParam as number | string, limit);
			return {
				...response,
				data: response.data.map(mapPost),
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.nextCursor) return lastPage.nextCursor;
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled,
		staleTime: 5 * 60 * 1000,
	});

	// manual refresh that bypasses cache (for authenticated users)
	const refreshFeed = async () => {
		const response = await fetchNewFeed(1, limit, true);
		return {
			...response,
			data: response.data.map(mapPost),
		};
	};

	return { ...query, refreshFeed };
};

export const useForYouFeed = (options?: { enabled?: boolean; limit?: number }) => {
	const { isLoggedIn } = useAuth();
	const enabled = options?.enabled ?? isLoggedIn;
	const limit = options?.limit ?? 10;

	return useInfiniteQuery<
		PaginatedResponse<IPost>,
		Error
	>({
		queryKey: ["forYouFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchForYouFeed(pageParam as number | string, limit);
			return {
				...response,
				data: response.data.map(mapPost),
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.nextCursor) return lastPage.nextCursor;
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
	});
};
