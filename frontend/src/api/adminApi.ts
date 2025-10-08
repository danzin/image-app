import axiosClient from "./axiosClient";
import { AdminUserDTO, PaginatedResponse, IImage } from "../types";

export interface DashboardStats {
	totalUsers: number;
	totalImages: number;
	bannedUsers: number;
	adminUsers: number;
	recentUsers: number;
	recentImages: number;
	growthRate: {
		users: number;
		images: number;
	};
}

export interface UserStats {
	totalImages: number;
	totalLikes: number;
	totalFollowers: number;
	totalFollowing: number;
	accountAge: number;
}

export interface RecentActivity {
	data: Array<{
		userId: string;
		username: string;
		action: string;
		targetType: string;
		targetId: string;
		timestamp: Date;
	}>;
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

export const fetchAllUsersAdmin = async (params: {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}): Promise<PaginatedResponse<AdminUserDTO>> => {
	const { data } = await axiosClient.get("/api/admin", { params });
	return data;
};

export const fetchUserAdmin = async (publicId: string): Promise<AdminUserDTO> => {
	const { data } = await axiosClient.get(`/api/admin/user/${publicId}`);
	return data;
};

export const fetchUserStats = async (publicId: string): Promise<UserStats> => {
	const { data } = await axiosClient.get(`/api/admin/user/${publicId}/stats`);
	return data;
};

export const banUser = async (publicId: string, reason: string): Promise<void> => {
	await axiosClient.put(`/api/admin/user/${publicId}/ban`, { reason });
};

export const unbanUser = async (publicId: string): Promise<void> => {
	await axiosClient.put(`/api/admin/user/${publicId}/unban`);
};

export const promoteToAdmin = async (publicId: string): Promise<AdminUserDTO> => {
	const { data } = await axiosClient.put(`/api/admin/user/${publicId}/promote`);
	return data;
};

export const demoteFromAdmin = async (publicId: string): Promise<AdminUserDTO> => {
	const { data } = await axiosClient.put(`/api/admin/user/${publicId}/demote`);
	return data;
};

export const deleteUserAdmin = async (publicId: string): Promise<void> => {
	await axiosClient.delete(`/api/admin/user/${publicId}`);
};

export const fetchAllImagesAdmin = async (params: {
	page?: number;
	limit?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}): Promise<PaginatedResponse<IImage>> => {
	const { data } = await axiosClient.get("/api/admin/images", { params });
	return data;
};

export const deleteImageAdmin = async (publicId: string): Promise<void> => {
	await axiosClient.delete(`/api/admin/image/${publicId}`);
};

export const fetchDashboardStats = async (): Promise<DashboardStats> => {
	const { data } = await axiosClient.get("/api/admin/dashboard/stats");
	return data;
};

export const fetchRecentActivity = async (params: { page?: number; limit?: number }): Promise<RecentActivity> => {
	const { data } = await axiosClient.get("/api/admin/dashboard/activity", { params });
	return data;
};

export const clearCache = async (
	pattern?: string
): Promise<{ message: string; pattern: string; deletedKeys: number }> => {
	const { data } = await axiosClient.delete("/api/admin/cache", {
		params: { pattern: pattern || "all_feeds" },
	});
	return data;
};
