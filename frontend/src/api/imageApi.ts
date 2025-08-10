import axiosClient from "./axiosClient";
import { IImage, ITag } from "../types";

export const fetchPersonalizedFeed = async (
	pageParam: number,
	limit: number
): Promise<{
	data: IImage[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/feed?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchImages = async (
	pageParam: number
): Promise<{
	data: IImage[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/images?page=${pageParam}`);
	return data;
};

export const fetchImageById = async (id: string) => {
	const { data } = await axiosClient.get(`/api/images/${id}`);
	return data;
};

export const fetchImagesByTag = async ({ tags, page, limit }: { tags: string[]; page: number; limit: number }) => {
	const tagString = tags.join(",");
	const { data } = await axiosClient.get(`/api/images/search/tags?tags=${tagString}&page=${page}&limit=${limit}`);
	console.log(data);
	return data;
};

export const uploadImage = async (image: FormData): Promise<IImage> => {
	const response = await axiosClient.post("/api/images/upload", image, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return response.data;
};

export const fetchTags = async (): Promise<ITag[]> => {
	const { data } = await axiosClient.get("/api/images/tags");
	console.log("TAGS:", data);
	return data;
};

export const deleteImageById = async (id: string): Promise<void> => {
	console.log("Deleting image with ID:", id);
	await axiosClient.delete(`/api/images/${id}`);
};
