import axiosClient from "./axiosClient";

// Follow/unfollow a user by their public ID
export const followUser = async (publicId: string) => {
	const response = await axiosClient.post(`/api/users/follow/${publicId}`);
	return response.data;
};

// Like/unlike an image by its public ID
export const likeImage = async (imagePublicId: string) => {
	const response = await axiosClient.post(`/api/users/like/image/${imagePublicId}`);
	return response.data;
};
