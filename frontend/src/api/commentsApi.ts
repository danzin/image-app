import axiosClient from "./axiosClient";
import { IComment, CommentCreateDto, CommentUpdateDto, CommentsPaginationResponse } from "../types";

const BASE_URL = "/api";

/**
 * Create a new comment on an image
 */
export const createComment = async (imagePublicId: string, commentData: CommentCreateDto): Promise<IComment> => {
	const response = await axiosClient.post(`${BASE_URL}/images/${imagePublicId}/comments`, commentData);
	return response.data;
};

/**
 * Get comments for an image with pagination
 */
export const getCommentsByImageId = async (
	imagePublicId: string,
	page: number = 1,
	limit: number = 10
): Promise<CommentsPaginationResponse> => {
	const response = await axiosClient.get(`${BASE_URL}/images/${imagePublicId}/comments`, {
		params: { page, limit },
	});
	return response.data;
};

/**
 * Update a comment
 */
export const updateComment = async (commentId: string, commentData: CommentUpdateDto): Promise<IComment> => {
	const response = await axiosClient.put(`${BASE_URL}/comments/${commentId}`, commentData);
	return response.data;
};

/**
 * Delete a comment
 */
export const deleteComment = async (commentId: string): Promise<void> => {
	await axiosClient.delete(`${BASE_URL}/comments/${commentId}`);
};

/**
 * Get comments by user ID
 */
export const getCommentsByUserId = async (
	userId: string,
	page: number = 1,
	limit: number = 10
): Promise<CommentsPaginationResponse> => {
	const response = await axiosClient.get(`${BASE_URL}/users/${userId}/comments`, {
		params: { page, limit },
	});
	return response.data;
};
