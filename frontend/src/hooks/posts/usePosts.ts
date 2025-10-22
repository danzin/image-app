import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "../../api/postApi";
import { IPost, ITag } from "../../types";
import { useAuth } from "../context/useAuth";
import { mapPost } from "../../lib/mappers";

export const usePersonalizedFeed = () => {
	const { isLoggedIn } = useAuth();

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
		queryKey: ["personalizedFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchPersonalizedFeed(pageParam as number, 5);
			return {
				...response,
				data: response.data.map((rawPost: IPost) => mapPost(rawPost)),
			};
		},
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		initialPageParam: 1,
		enabled: isLoggedIn,
		staleTime: 0,
	});
};

export const usePosts = () => {
	const { user, loading } = useAuth();

	const queryKey = ["posts", user?.publicId];
	console.log("usePosts - Query Key:", queryKey, "User state:", { user: user?.publicId, loading });

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
		queryKey,
		queryFn: async ({ pageParam = 1 }) => {
			console.log("usePosts - Fetching with queryKey:", queryKey, "pageParam:", pageParam);
			const response = await fetchPosts(pageParam as number);
			console.log("usePosts - Raw response for query:", queryKey, response.data[0]);

			const mappedData = response.data.map((rawPost: IPost) => {
				const mapped = mapPost(rawPost);
				console.log("usePosts - Mapped post for query:", queryKey, mapped);
				return mapped;
			});

			return {
				...response,
				data: mappedData,
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled: !loading,
		staleTime: 0,
		gcTime: 0,
		refetchOnMount: true,
	});
};

// Get post by public ID (preferred method)
export const usePostByPublicId = (publicId: string) => {
	const { user, loading } = useAuth();

	return useQuery<IPost, Error>({
		queryKey: ["post", "publicId", publicId, user?.publicId], // Include user in query key
		queryFn: async () => {
			const rawPost = await fetchPostByPublicId(publicId);
			return mapPost(rawPost);
		},
		enabled: !!publicId && !loading, // Wait for auth
		staleTime: 0,
		refetchOnMount: true,
	});
};

// Get post by slug (SEO-friendly URLs)
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

// Legacy method - always fetches by publicId (strips file extensions if present)
export const usePostById = (identifier: string) => {
	const { user } = useAuth();

	// Strip file extension if present (e.g., "abc-123.png" -> "abc-123")
	const cleanIdentifier = identifier ? identifier.replace(/\.(png|jpg|jpeg|gif|webp)$/i, "") : identifier;

	return useQuery<IPost, Error>({
		queryKey: ["post", cleanIdentifier],
		queryFn: async () => {
			const rawPost = await fetchPostByPublicId(cleanIdentifier);
			console.log("Raw post from API:", rawPost);
			console.log("Raw post isLikedByViewer:", rawPost.isLikedByViewer);
			const mappedPost = mapPost(rawPost);
			console.log("Mapped post:", mappedPost);
			console.log("User publicId for mapping:", user?.publicId);
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
			// invalidate and refetch current user to update imageCount immediately
			await queryClient.invalidateQueries({ queryKey: ["currentUser"] });
			await queryClient.refetchQueries({ queryKey: ["currentUser"] });

			// invalidate all post-related queries
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			queryClient.invalidateQueries({ queryKey: ["post"] });
			queryClient.invalidateQueries({ queryKey: ["user"] });
			queryClient.invalidateQueries({ queryKey: ["userPosts"] });
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });

			// refetch active queries to show the new post immediately
			queryClient.refetchQueries({ queryKey: ["posts"], type: "active" });
			queryClient.refetchQueries({ queryKey: ["personalizedFeed"], type: "active" });
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

export const useTrendingFeed = () => {
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
		queryKey: ["trendingFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchTrendingFeed(pageParam as number, 10);
			return {
				...response,
				data: response.data.map(mapPost),
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		staleTime: 2 * 60 * 1000, // 2 minutes - backend cache TTL
		refetchOnWindowFocus: false,
	});
};

export const useNewFeed = () => {
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
		queryKey: ["newFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchNewFeed(pageParam as number, 10);
			return {
				...response,
				data: response.data.map(mapPost),
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		staleTime: 1 * 60 * 1000, // 1 minute - backend cache TTL
		refetchOnWindowFocus: false,
	});
};

export const useForYouFeed = () => {
	const { isLoggedIn } = useAuth();

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
		queryKey: ["forYouFeed"],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchForYouFeed(pageParam as number, 10);
			return {
				...response,
				data: response.data.map(mapPost),
			};
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled: isLoggedIn,
		staleTime: 5 * 60 * 1000, // 5 minutes - backend cache TTL
		refetchOnWindowFocus: false,
	});
};

// === LEGACY ALIASES FOR BACKWARD COMPATIBILITY ===

export const useImages = usePosts;
export const useImageByPublicId = usePostByPublicId;
export const useImageBySlug = usePostBySlug;
export const useImageById = usePostById;
export const useImagesByTag = usePostsByTag;
export const useUploadImage = useUploadPost;
export const useDeleteImage = useDeletePost;
