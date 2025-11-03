import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import {
	createComment,
	getCommentsByPostId,
	updateComment,
	deleteComment,
	getCommentsByUserId,
} from "../../api/commentsApi";
import { IComment, CommentCreateDto, CommentUpdateDto, CommentsPaginationResponse } from "../../types";

/**
 * Get comments for an image with infinite scrolling
 */
export const useCommentsByPostId = (postPublicId: string, limit: number = 10) => {
	return useInfiniteQuery<CommentsPaginationResponse, Error>({
		queryKey: ["comments", "post", postPublicId],
		queryFn: ({ pageParam = 1 }) => getCommentsByPostId(postPublicId, pageParam as number, limit),
		getNextPageParam: (lastPage) => {
			if (lastPage.page < lastPage.totalPages) {
				return lastPage.page + 1;
			}
			return undefined;
		},
		initialPageParam: 1,
		enabled: !!postPublicId,
		staleTime: 0, // Comments should be fresh
	});
};

/**
 * Get comments for an image (single page)
 */
export const useCommentsForPost = (postPublicId: string, page: number = 1, limit: number = 10) => {
	return useQuery<CommentsPaginationResponse, Error>({
		queryKey: ["comments", "post", postPublicId, page, limit],
		queryFn: () => getCommentsByPostId(postPublicId, page, limit),
		enabled: !!postPublicId,
		staleTime: 0,
	});
};

/**
 * Create a new comment
 */
export const useCreateComment = () => {
	const queryClient = useQueryClient();

	return useMutation<IComment, Error, { imagePublicId: string; commentData: CommentCreateDto }>({
		mutationFn: ({ imagePublicId, commentData }) => createComment(imagePublicId, commentData),
		onSuccess: (newComment, { imagePublicId }) => {
			// Invalidate and refetch comments for this post
			queryClient.invalidateQueries({
				queryKey: ["comments", "post", imagePublicId],
			});

			// Update the post's comment count
			queryClient.invalidateQueries({
				queryKey: ["post", imagePublicId],
			});

			// Update posts list to reflect new comment count
			queryClient.invalidateQueries({
				queryKey: ["posts"],
			});
			queryClient.invalidateQueries({
				queryKey: ["personalizedFeed"],
			});
			queryClient.invalidateQueries({
				queryKey: ["newFeed"],
			});
		},
		onError: (error: Error) => {
			console.error("Error creating comment:", error);
		},
	});
};

/**
 * Update a comment
 */
export const useUpdateComment = () => {
	const queryClient = useQueryClient();

	return useMutation<IComment, Error, { commentId: string; commentData: CommentUpdateDto }>({
		mutationFn: ({ commentId, commentData }) => updateComment(commentId, commentData),
		onSuccess: (updatedComment) => {
			// Invalidate comments for the post this comment belongs to
			queryClient.invalidateQueries({
				queryKey: ["comments", "post", updatedComment.postPublicId],
			});
		},
		onError: (error: Error) => {
			console.error("Error updating comment:", error);
		},
	});
};

/**
 * Delete a comment
 */
export const useDeleteComment = () => {
	const queryClient = useQueryClient();

	return useMutation<void, Error, { commentId: string; postPublicId: string }>({
		mutationFn: ({ commentId }) => deleteComment(commentId),
		onSuccess: (_, { postPublicId }) => {
			// Invalidate and refetch comments for this post
			queryClient.invalidateQueries({
				queryKey: ["comments", "post", postPublicId],
			});

			// Update the post's comment count
			queryClient.invalidateQueries({
				queryKey: ["post", postPublicId],
			});

			// Update posts list to reflect new comment count
			queryClient.invalidateQueries({
				queryKey: ["posts"],
			});
			queryClient.invalidateQueries({
				queryKey: ["personalizedFeed"],
			});
			queryClient.invalidateQueries({
				queryKey: ["newFeed"],
			});
		},
		onError: (error: Error) => {
			console.error("Error deleting comment:", error);
		},
	});
};

/**
 * Get comments by user ID
 */
export const useCommentsByUserId = (userId: string, page: number = 1, limit: number = 10) => {
	return useQuery<CommentsPaginationResponse, Error>({
		queryKey: ["comments", "user", userId, page, limit],
		queryFn: () => getCommentsByUserId(userId, page, limit),
		enabled: !!userId,
		staleTime: 5 * 60 * 1000, // 5 minutes for user comments
	});
};
