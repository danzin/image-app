import axiosClient from "./axiosClient";
import { ImagePageData, PublicUserDTO, AuthenticatedUserDTO, AdminUserDTO } from "../types";
import axios, { AxiosError } from "axios";

// Login returns user and token
export const loginRequest = async (credentials: {
	email: string;
	password: string;
}): Promise<{ user: PublicUserDTO | AdminUserDTO; token: string }> => {
	const response = await axiosClient.post("/api/users/login", credentials);
	return response.data;
};

// Register returns the full response with user and token
export const registerRequest = async (credentials: {
	username: string;
	email: string;
	password: string;
}): Promise<{ user: PublicUserDTO; token: string }> => {
	const response = await axiosClient.post("/api/users/register", credentials);
	return response.data; // { user: PublicUserDTO, token: string }
};

// Check if following using public ID
export const fetchIsFollowing = async ({ queryKey }: { queryKey: [string, string] }): Promise<boolean> => {
	const [, publicId] = queryKey;
	const { data } = await axiosClient.get(`/api/users/follows/${publicId}`);
	return data.isFollowing;
};

// Get current user (me endpoint)
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
			// Auth specific
			if (status === 401 || status === 403) {
				throw Object.assign(new Error("UNAUTHORIZED"), info);
			}
			// Re-throw with context for diagnostics
			throw Object.assign(err, info);
		}
		throw err as AxiosError; // non-axios
	}
};

// Get user by public ID
export const fetchUserByPublicId = async ({ queryKey }: { queryKey: [string, string] }): Promise<PublicUserDTO> => {
	const [, publicId] = queryKey;
	const response = await axiosClient.get(`/api/users/public/${publicId}`);
	return response.data;
};

// Get user by username (for profile pages)
export const fetchUserByUsername = async ({ queryKey }: { queryKey: [string, string] }): Promise<PublicUserDTO> => {
	const [, username] = queryKey;
	const response = await axiosClient.get(`/api/users/profile/${username}`);
	return response.data;
};

// Get user images by user public ID
export const fetchUserImages = async (pageParam: number, userPublicId: string): Promise<ImagePageData> => {
	try {
		const { data } = await axiosClient.get(`/api/images/user/public/${userPublicId}?page=${pageParam}`);
		return data;
	} catch (error) {
		console.error("Error fetching user images:", error);
		throw error;
	}
};

// Update user avatar
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

// Update user cover
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

// Update user profile
export const editUserRequest = async (updateData: {
	username?: string;
	bio?: string;
}): Promise<AuthenticatedUserDTO | AdminUserDTO> => {
	const response = await axiosClient.put("/api/users/me/edit", updateData);
	return response.data;
};

// Change password
export const changePasswordRequest = async (passwords: {
	currentPassword: string;
	newPassword: string;
}): Promise<void> => {
	await axiosClient.put("/api/users/me/change-password", passwords);
};
