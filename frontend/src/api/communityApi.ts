import axiosClient from "./axiosClient";
import { ICommunity, CreateCommunityDTO, ICommunityMember } from "../types";

export const fetchCommunityMembers = async (
	slug: string,
	pageParam: number,
	limit: number = 20
): Promise<{
	data: ICommunityMember[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/communities/${slug}/members?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchCommunities = async (
	pageParam: number,
	limit: number = 20
): Promise<{
	data: ICommunity[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/communities?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchUserCommunities = async (
	pageParam: number,
	limit: number = 20
): Promise<{
	data: ICommunity[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/communities/me?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchCommunity = async (slug: string): Promise<ICommunity> => {
	const { data } = await axiosClient.get(`/api/communities/${slug}`);
	return data;
};

export const createCommunity = async (communityData: CreateCommunityDTO): Promise<ICommunity> => {
	const formData = new FormData();
	formData.append("name", communityData.name);
	formData.append("description", communityData.description);
	if (communityData.avatar) {
		formData.append("avatar", communityData.avatar);
	}

	const { data } = await axiosClient.post("/api/communities", formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
	return data;
};

export const joinCommunity = async (communityPublicId: string): Promise<void> => {
	await axiosClient.post(`/api/communities/${communityPublicId}/join`);
};

export const leaveCommunity = async (communityPublicId: string): Promise<void> => {
	await axiosClient.post(`/api/communities/${communityPublicId}/leave`);
};

export const kickMember = async (communityPublicId: string, userPublicId: string): Promise<void> => {
	await axiosClient.delete(`/api/communities/${communityPublicId}/members/${userPublicId}`);
};
