import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	fetchImages,
	fetchImageByPublicId,
	fetchImageBySlug,
	uploadImage,
	fetchTags,
	fetchImagesByTag,
	deleteImageByPublicId,
	fetchPersonalizedFeed,
} from "../../api/imageApi";
import { IImage, ITag } from "../../types";
import { useAuth } from "../context/useAuth";

export const usePersonalizedFeed = () => {
	const { isLoggedIn } = useAuth();

	return useInfiniteQuery<
		{
			data: IImage[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		},
		Error
	>({
		queryKey: ["personalizedFeed"],
		queryFn: ({ pageParam = 1 }) => fetchPersonalizedFeed(pageParam as number, 5),
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		initialPageParam: 1,
		enabled: isLoggedIn, // Only enable when user is logged in
		staleTime: 0,
	});
};

export const useImages = () => {
	return useInfiniteQuery<
		{
			data: IImage[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		},
		Error
	>({
		queryKey: ["images"],
		queryFn: ({ pageParam = 1 }) => {
			return fetchImages(pageParam as number);
		},
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		staleTime: 0,
	});
};

// Get image by public ID (preferred method)
export const useImageByPublicId = (publicId: string) => {
	return useQuery<IImage, Error>({
		queryKey: ["image", "publicId", publicId],
		queryFn: () => fetchImageByPublicId(publicId),
		enabled: !!publicId,
		staleTime: 0,
		refetchOnMount: true,
	});
};

// Get image by slug (SEO-friendly URLs)
export const useImageBySlug = (slug: string) => {
	return useQuery<IImage, Error>({
		queryKey: ["image", "slug", slug],
		queryFn: () => fetchImageBySlug(slug),
		enabled: !!slug,
		staleTime: 0,
		refetchOnMount: true,
	});
};

// Legacy method - tries to determine if identifier is publicId or slug
export const useImageById = (identifier: string) => {
	// Check if identifier looks like a UUID (publicId)
	const isPublicId = identifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

	return useQuery<IImage, Error>({
		queryKey: ["image", identifier],
		queryFn: () => {
			if (isPublicId) {
				return fetchImageByPublicId(identifier);
			} else {
				return fetchImageBySlug(identifier);
			}
		},
		enabled: !!identifier,
		staleTime: 0,
		refetchOnMount: true,
	});
};

export const useImagesByTag = (
	tags: string[],
	options?: {
		limit?: number;
		enabled?: boolean;
	}
) => {
	const limit = options?.limit ?? 10; // Default to 10 if not provided
	const enabled = options?.enabled ?? tags.length > 0; // Default enabled

	return useInfiniteQuery<
		{
			data: IImage[];
			total: number;
			page: number;
			limit: number;
			totalPages: number;
		},
		Error
	>({
		queryKey: ["imagesByTag", tags],
		queryFn: ({ pageParam = 1 }) => fetchImagesByTag({ tags, page: pageParam as number, limit }),
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

export const useUploadImage = () => {
	const queryClient = useQueryClient();

	return useMutation<IImage, Error, FormData>({
		mutationFn: uploadImage,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["images"] });
			queryClient.invalidateQueries({ queryKey: ["user"] });
			queryClient.invalidateQueries({ queryKey: ["userImages"] });
			queryClient.invalidateQueries({ queryKey: ["tags"] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
		},
		onError: (error: Error) => {
			console.error("Error uploading image:", error);
		},
	});
};

export const useDeleteImage = () => {
	const queryClient = useQueryClient();

	return useMutation<void, Error, string>({
		mutationFn: deleteImageByPublicId, // Use the new function that takes publicId
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["images"] });
			queryClient.invalidateQueries({ queryKey: ["user"] });
			queryClient.invalidateQueries({ queryKey: ["userImages"] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
		},
		onError: (error: Error) => {
			console.error("Error deleting image:", error);
		},
	});
};
