import axiosClient from "./axiosClient";
import { IImage, IUser } from "../types";

export const loginRequest = async (credentials: any) => {
  const response = await axiosClient.post("/users/login", credentials);
  return response.data;
};

export const registerRequest = async (credentials: any) => {
  const response = await axiosClient.post("/users/register", credentials);
  return response.data;
};

export const fetchIsFollowing = async ({
  queryKey,
}: {
  queryKey: any;
}): Promise<any> => {
  const [, followeeId] = queryKey;
  const { data } = await axiosClient.get(`/users/follows/${followeeId}`);
  return data.isFollowing;
};

export const fetchCurrentUser = async (): Promise<IUser> => {
  const { data } = await axiosClient.get("/users/me");
  return data;
};

export const fetchUserData = async ({
  queryKey,
}: {
  queryKey: any;
}): Promise<any> => {
  const [, id] = queryKey;
  const response = await axiosClient.get(`/users/${id}`);
  console.log("response from fetchUserData:", response.data);
  return response.data;
};

export const fetchUserImages = async (
  pageParam: number,
  userId: string
): Promise<{
  data: IImage[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> => {
  const { data } = await axiosClient.get(
    `/images/user/${userId}?page=${pageParam}`
  );
  return data;
};

export const updateUserAvatar = async (avatar: FormData): Promise<any> => {
  const { data } = await axiosClient.put("/users/avatar", avatar);
  return data;
};

export const updateUserCover = async (cover: FormData): Promise<any> => {
  const { data } = await axiosClient.put("/users/cover", cover);
  return data;
};
