import axiosClient from './axiosClient';


export const followUser = async (followeeId: string) => {
  const response = await axiosClient.post(`/users/follow/${followeeId}`);
  return response.data;
};


export const likeImage = async (imageId: string) => {
  const response = await axiosClient.post(`/users/like/${imageId}`);
  return response.data;
};
