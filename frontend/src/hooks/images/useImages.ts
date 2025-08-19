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
import { mapImage } from "../../lib/mappers";

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
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchPersonalizedFeed(pageParam as number, 5);
			return {
				...response,
				data: response.data.map((rawImage: IImage) => mapImage(rawImage)),
			};
		},
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		initialPageParam: 1,
		enabled: isLoggedIn,
		staleTime: 0,
	});
};

export const useImages = () => {
	const { user, loading } = useAuth();

	const queryKey = ["images", user?.publicId];
	console.log("useImages - Query Key:", queryKey, "User state:", { user: user?.publicId, loading });

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
		queryKey,
		queryFn: async ({ pageParam = 1 }) => {
			console.log("useImages - Fetching with queryKey:", queryKey, "pageParam:", pageParam);
			const response = await fetchImages(pageParam as number);
			console.log("useImages - Raw response for query:", queryKey, response.data[0]);

			const mappedData = response.data.map((rawImage: IImage) => {
				const mapped = mapImage(rawImage);
				console.log("useImages - Mapped image for query:", queryKey, mapped);
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

// Get image by public ID (preferred method)
export const useImageByPublicId = (publicId: string) => {
	const { user, loading } = useAuth();

	return useQuery<IImage, Error>({
		queryKey: ["image", "publicId", publicId, user?.publicId], // Include user in query key
		queryFn: async () => {
			const rawImage = await fetchImageByPublicId(publicId);
			return mapImage(rawImage);
		},
		enabled: !!publicId && !loading, // Wait for auth
		staleTime: 0,
		refetchOnMount: true,
	});
};

// Get image by slug (SEO-friendly URLs)
export const useImageBySlug = (slug: string) => {
	return useQuery<IImage, Error>({
		queryKey: ["image", "slug", slug],
		queryFn: async () => {
			const rawImage = await fetchImageBySlug(slug);
			return mapImage(rawImage);
		},
		enabled: !!slug,
		staleTime: 0,
		refetchOnMount: true,
	});
};

// Legacy method - tries to determine if identifier is publicId or slug
export const useImageById = (identifier: string) => {
	const { user } = useAuth();

	// Check if identifier looks like a UUID (publicId)
	const isPublicId = identifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

	return useQuery<IImage, Error>({
		queryKey: ["image", identifier],
		queryFn: async () => {
			const rawImage = isPublicId ? await fetchImageByPublicId(identifier) : await fetchImageBySlug(identifier);
			console.log("Raw image from API:", rawImage);
			console.log("Raw image isLikedByViewer:", rawImage.isLikedByViewer);
			const mappedImage = mapImage(rawImage);
			console.log("Mapped image:", mappedImage);
			console.log("User publicId for mapping:", user?.publicId);
			return mappedImage;
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
	const limit = options?.limit ?? 10;
	const enabled = options?.enabled ?? tags.length > 0;

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
		queryFn: async ({ pageParam = 1 }) => {
			const response = await fetchImagesByTag({ tags, page: pageParam as number, limit });
			return {
				...response,
				data: response.data.map((rawImage: IImage) => mapImage(rawImage)),
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
		mutationFn: deleteImageByPublicId,
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
