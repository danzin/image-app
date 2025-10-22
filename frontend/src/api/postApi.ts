import axiosClient from "./axiosClient";
import { IPost, ITag } from "../types";

export const fetchPersonalizedFeed = async (
	pageParam: number,
	limit: number
): Promise<{
	data: IPost[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/feed?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchTrendingFeed = async (
	pageParam: number,
	limit: number = 20
): Promise<{
	data: IPost[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/feed/trending?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchNewFeed = async (
	pageParam: number,
	limit: number = 20
): Promise<{
	data: IPost[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/feed/new?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchForYouFeed = async (
	pageParam: number,
	limit: number = 20
): Promise<{
	data: IPost[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/feed/for-you?page=${pageParam}&limit=${limit}`);
	return data;
};

export const fetchPosts = async (
	pageParam: number
): Promise<{
	data: IPost[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}> => {
	const { data } = await axiosClient.get(`/api/posts?page=${pageParam}`);
	return data;
};

// Get post by public ID
export const fetchPostByPublicId = async (publicId: string) => {
	console.log(`Fetching post by public ID: ${publicId}`);
	const { data } = await axiosClient.get(`/api/posts/${publicId}`);
	return data;
};

// Get post by slug (SEO-friendly)
export const fetchPostBySlug = async (slug: string) => {
	console.log("Fetching post by slug:", slug);
	const { data } = await axiosClient.get(`/api/posts/slug/${slug}`);
	return data;
};

export const fetchPostsByTag = async ({ tags, page, limit }: { tags: string[]; page: number; limit: number }) => {
	const tagString = tags.join(",");
	const { data } = await axiosClient.get(`/api/posts/search/tags?tags=${tagString}&page=${page}&limit=${limit}`);
	console.log(data);
	return data;
};

export const uploadPost = async (post: FormData): Promise<IPost> => {
	const response = await axiosClient.post("/api/posts", post, {
		headers: { "Content-Type": "multipart/form-data" },
	});
	return response.data;
};

export const fetchTags = async (): Promise<ITag[]> => {
	const { data } = await axiosClient.get("/api/posts/tags");
	console.log("TAGS:", data);
	return data;
};

// Delete post by public ID
export const deletePostByPublicId = async (publicId: string): Promise<void> => {
	console.log("Deleting post with public ID:", publicId);
	await axiosClient.delete(`/api/posts/${publicId}`);
};
