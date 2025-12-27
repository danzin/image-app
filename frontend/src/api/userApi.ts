import axiosClient from "./axiosClient";
import {
	ImagePageData,
	PublicUserDTO,
	AuthenticatedUserDTO,
	AdminUserDTO,
	WhoToFollowResponse,
	IComment,
} from "../types";
import axios, { AxiosError } from "axios";

// Login returns user and token
export const loginRequest = async (credentials: {
	email: string;
	password: string;
}): Promise<{ user: AuthenticatedUserDTO | AdminUserDTO; token: string }> => {
	const response = await axiosClient.post("/api/users/login", credentials);
	return response.data;
};

// Register returns the full response with user and token
export const registerRequest = async (credentials: {
	username: string;
	email: string;
	password: string;
}): Promise<{ user: AuthenticatedUserDTO; token: string }> => {
	const response = await axiosClient.post("/api/users/register", credentials);
	return response.data;
};

// Check if following using public ID
export const fetchIsFollowing = async ({ queryKey }: { queryKey: [string, string] }): Promise<boolean> => {
	const [, publicId] = queryKey;
	const { data } = await axiosClient.get(`/api/users/follows/${publicId}`);
	return data.isFollowing;
};

// Get current user at /me
export const fetchCurrentUser = async (signal?: AbortSignal): Promise<AuthenticatedUserDTO | AdminUserDTO> => {
	try {
		const { data } = await axiosClient.get<AuthenticatedUserDTO | AdminUserDTO>("/api/users/me", { signal });
		return data;
	} catch (err) {
		if (axios.isAxiosError(err)) {
			const status = err.response?.status;
			const info = {
				status,
				url: "/api/users/me",
				message: err.message,
				code: err.code,
			};
			if (status === 401 || status === 403) {
				throw Object.assign(new Error("UNAUTHORIZED"), info);
			}
			throw Object.assign(err, info);
		}
		throw err as AxiosError;
	}
};

export const fetchUserByPublicId = async ({ queryKey }: { queryKey: [string, string] }): Promise<PublicUserDTO> => {
	const [, publicId] = queryKey;
	const response = await axiosClient.get(`/api/users/public/${publicId}`);
	return response.data;
};

export const fetchUserByUsername = async ({ queryKey }: { queryKey: [string, string] }): Promise<PublicUserDTO> => {
	const [, username] = queryKey;
	const response = await axiosClient.get(`/api/users/profile/${username}`);
	return response.data;
};

export const fetchUserPosts = async (pageParam: number, userPublicId: string): Promise<ImagePageData> => {
	try {
		const { data } = await axiosClient.get(`/api/posts/user/${userPublicId}?page=${pageParam}`);
		return data;
	} catch (error) {
		console.error("Error fetching user posts:", error);
		throw error;
	}
};

export const fetchUserLikedPosts = async (pageParam: number, userPublicId: string): Promise<ImagePageData> => {
	try {
		const { data } = await axiosClient.get(`/api/posts/user/${userPublicId}/likes?page=${pageParam}`);
		return data;
	} catch (error) {
		console.error("Error fetching user liked posts:", error);
		throw error;
	}
};

export const fetchUserComments = async (
	pageParam: number,
	userPublicId: string
): Promise<{
	comments: IComment[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	try {
		const { data } = await axiosClient.get(`/api/users/${userPublicId}/comments?page=${pageParam}`);
		return data;
	} catch (error) {
		console.error("Error fetching user comments:", error);
		throw error;
	}
};

export const updateUserAvatar = async (avatar: Blob): Promise<AuthenticatedUserDTO | AdminUserDTO> => {
	const formData = new FormData();
	formData.append("avatar", avatar, `avatar.${avatar.type.split("/")[1] || "png"}`);

	const { data } = await axiosClient.put("/api/users/me/avatar", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
	return data;
};

export const updateUserCover = async (cover: Blob): Promise<AuthenticatedUserDTO | AdminUserDTO> => {
	const formData = new FormData();
	formData.append("cover", cover, `cover.${cover.type.split("/")[1] || "png"}`);

	const { data } = await axiosClient.put("/api/users/me/cover", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
	return data;
};

export const editUserRequest = async (updateData: {
	username?: string;
	bio?: string;
}): Promise<AuthenticatedUserDTO | AdminUserDTO> => {
	const response = await axiosClient.put("/api/users/me/edit", updateData);
	return response.data;
};

export const changePasswordRequest = async (passwords: {
	currentPassword: string;
	newPassword: string;
}): Promise<void> => {
	await axiosClient.put("/api/users/me/change-password", passwords);
};

export const fetchWhoToFollow = async (limit: number = 5): Promise<WhoToFollowResponse> => {
	const { data } = await axiosClient.get(`/api/users/suggestions/who-to-follow?limit=${limit}`);
	return data;
};

export interface FollowUserItem {
	publicId: string;
	username: string;
	avatar: string;
	bio?: string;
}

export interface FollowListResponse {
	users: FollowUserItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export const fetchFollowers = async (
	userPublicId: string,
	page: number = 1,
	limit: number = 20
): Promise<FollowListResponse> => {
	const { data } = await axiosClient.get(`/api/users/${userPublicId}/followers?page=${page}&limit=${limit}`);
	return data;
};

export const fetchFollowing = async (
	userPublicId: string,
	page: number = 1,
	limit: number = 20
): Promise<FollowListResponse> => {
	const { data } = await axiosClient.get(`/api/users/${userPublicId}/following?page=${page}&limit=${limit}`);
	return data;
};

export const requestPasswordReset = async (payload: { email: string }): Promise<void> => {
	await axiosClient.post("/api/users/forgot-password", payload);
};
