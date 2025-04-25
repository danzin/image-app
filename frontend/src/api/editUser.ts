import axiosClient from "./axiosClient";

export const editUserRequest = async (updateData: any) => {
  console.log("updateData:", updateData);
  const response = await axiosClient.put("/users/edit", updateData);
  console.log("responseData:", response.data);
  return response.data;
};
