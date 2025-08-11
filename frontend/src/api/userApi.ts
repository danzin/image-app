import axiosClient from "./axiosClient";
import { ImagePageData, IUser } from "../types";

export const loginRequest = async (credentials: any) => {
	const response = await axiosClient.post("/api/users/login", credentials);
	return response.data;
};

export const registerRequest = async (credentials: any) => {
	const response = await axiosClient.post("/api/users/register", credentials);
	return response.data;
};

export const fetchIsFollowing = async ({ queryKey }: { queryKey: any }): Promise<any> => {
	const [, followeeId] = queryKey;
	const { data } = await axiosClient.get(`/api/users/follows/${followeeId}`);
	return data.isFollowing;
};

export const fetchCurrentUser = async (): Promise<IUser> => {
	const { data } = await axiosClient.get("/api/users/me");
	return data;
};

export const fetchUserData = async ({ queryKey }: { queryKey: any }): Promise<any> => {
	const [, id] = queryKey;
	const response = await axiosClient.get(`/api/users/${id}`);
	console.log("response from fetchUserData:", response.data);
	return response.data;
};

export const fetchUserImages = async (pageParam: number, userId: string): Promise<ImagePageData> => {
	try {
		const { data } = await axiosClient.get(`/api/images/user/${userId}?page=${pageParam}`);
		return data;
	} catch (error) {
		console.error("Error fetching user images:", error);
		throw error;
	}
};

export const updateUserAvatar = async (avatar: Blob): Promise<any> => {
	const formData = new FormData();
	formData.append("avatar", avatar, `cover.${avatar.type.split("/")[1] || "png"}`);

	const { data } = await axiosClient.put("/api/users/avatar", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
	return data;
};

export const updateUserCover = async (cover: Blob): Promise<any> => {
	// Expect Blob
	const formData = new FormData();

	formData.append("cover", cover, `cover.${cover.type.split("/")[1] || "png"}`);
	const { data } = await axiosClient.put("/api/users/cover", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
	return data;
};

export const editUserRequest = async (updateData: Partial<IUser>): Promise<IUser> => {
	const response = await axiosClient.put("/api/users/edit", updateData);
	return response.data;
};

export const changePasswordRequest = async (passwords: {
	currentPassword: string;
	newPassword: string;
}): Promise<void> => {
	await axiosClient.put("/api/users/change-password", passwords);
};
