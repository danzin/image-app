import axiosClient from "./axiosClient";
import { IImage, ImagePageData, IUser } from "../types";

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
): Promise<ImagePageData> => {
  try {
    const { data } = await axiosClient.get(
      `/images/user/${userId}?page=${pageParam}`
    );
    return data;
  } catch (error) {
    console.error("Error fetching user images:", error);
    throw error;
  }
};

export const updateUserAvatar = async (avatar: Blob): Promise<any> => {
  const formData = new FormData();
  formData.append(
    "avatar",
    avatar,
    `cover.${avatar.type.split("/")[1] || "png"}`
  );

  const { data } = await axiosClient.put("/users/avatar", formData, {
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
  const { data } = await axiosClient.put("/users/cover", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return data;
};
