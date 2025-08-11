import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
	createComment,
	getCommentsByImageId,
	updateComment,
	deleteComment,
	getCommentsByUserId,
} from "../../api/comments";
import { IComment, CommentCreateDto, CommentUpdateDto, CommentsPaginationResponse } from "../../types";

/**
 * Hook to get comments for an image with infinite scrolling
 */
export const useCommentsByImageId = (imageId: string, limit: number = 10) => {
	return useInfiniteQuery<CommentsPaginationResponse, Error>({
		queryKey: ["comments", "image", imageId],
		queryFn: ({ pageParam = 1 }) => getCommentsByImageId(imageId, pageParam as number, limit),
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled: !!imageId,
		staleTime: 0, // Comments should be fresh
	});
};

/**
 * Hook to get comments for an image (single page)
 */
export const useCommentsForImage = (imageId: string, page: number = 1, limit: number = 10) => {
	return useQuery<CommentsPaginationResponse, Error>({
		queryKey: ["comments", "image", imageId, page, limit],
		queryFn: () => getCommentsByImageId(imageId, page, limit),
		enabled: !!imageId,
		staleTime: 0,
	});
};

/**
 * Hook to create a new comment
 */
export const useCreateComment = () => {
	const queryClient = useQueryClient();

	return useMutation<IComment, Error, { imageId: string; commentData: CommentCreateDto }>({
		mutationFn: ({ imageId, commentData }) => createComment(imageId, commentData),
		onSuccess: (newComment, { imageId }) => {
			// Invalidate and refetch comments for this image
			queryClient.invalidateQueries({
				queryKey: ["comments", "image", imageId],
			});

			// Update the image's comment count if data
			queryClient.invalidateQueries({
				queryKey: ["image", imageId],
			});

			// Update images list to reflect new comment count
			queryClient.invalidateQueries({
				queryKey: ["images"],
			});
		},
		onError: (error: Error) => {
			console.error("Error creating comment:", error);
		},
	});
};

/**
 * Hook to update a comment
 */
export const useUpdateComment = () => {
	const queryClient = useQueryClient();

	return useMutation<IComment, Error, { commentId: string; commentData: CommentUpdateDto }>({
		mutationFn: ({ commentId, commentData }) => updateComment(commentId, commentData),
		onSuccess: (updatedComment) => {
			// Invalidate comments for the image this comment belongs to
			queryClient.invalidateQueries({
				queryKey: ["comments", "image", updatedComment.imageId],
			});
		},
		onError: (error: Error) => {
			console.error("Error updating comment:", error);
		},
	});
};

/**
 * Hook to delete a comment
 */
export const useDeleteComment = () => {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { commentId: string; imageId: string }>({
		mutationFn: ({ commentId }) => deleteComment(commentId),
		onSuccess: (_, { imageId }) => {
			// Invalidate and refetch comments for this image
			queryClient.invalidateQueries({
				queryKey: ["comments", "image", imageId],
			});

			// Update the image's comment count
			queryClient.invalidateQueries({
				queryKey: ["image", imageId],
			});

			// Update images list to reflect new comment count
			queryClient.invalidateQueries({
				queryKey: ["images"],
			});
		},
		onError: (error: Error) => {
			console.error("Error deleting comment:", error);
		},
	});
};

/**
 * Hook to get comments by user ID
 */
export const useCommentsByUserId = (userId: string, page: number = 1, limit: number = 10) => {
	return useQuery<CommentsPaginationResponse, Error>({
		queryKey: ["comments", "user", userId, page, limit],
		queryFn: () => getCommentsByUserId(userId, page, limit),
		enabled: !!userId,
		staleTime: 5 * 60 * 1000, // 5 minutes for user comments
	});
};
