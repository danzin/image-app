import {
  useQuery,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  InfiniteData,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  fetchCurrentUser,
  fetchUserData,
  fetchUserImages,
  updateUserAvatar as updateUserAvatarApi,
  updateUserCover as updateUserCoverApi,
} from "../../api/userApi";
import { ImagePageData, IUser } from "../../types";
import { editUserRequest, changePasswordRequest } from "../../api/userApi";

type UseUserImagesOptions = Omit<
  UseInfiniteQueryOptions<
    ImagePageData,
    Error,
    InfiniteData<ImagePageData, number>
  >,
  "queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

export const useCurrentUser = () => {
  return useQuery<IUser>({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
    staleTime: 6000,
  });
};

export const useGetUser = (id: string | undefined) => {
  return useQuery<IUser>({
    queryKey: ["user", id],
    queryFn: () => fetchUserData({ queryKey: ["user", id!] }),
    enabled: !!id,
    staleTime: 60000,
  });
};

export const useUserImages = (
  userId: string,
  options?: UseUserImagesOptions
) => {
  return useInfiniteQuery({
    queryKey: ["userImages", userId] as const,
    queryFn: ({ pageParam = 1 }) =>
      fetchUserImages(pageParam as number, userId),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    ...options,
  });
};

export const useUpdateUserAvatar = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserAvatarApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });

      queryClient.invalidateQueries({ queryKey: ["userImages"] });
    },
    onError(error) {
      console.error("Avatar update failed:", error);
    },
  });
};

export const useUpdateUserCover = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateUserCoverApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
    onError: (error) => {
      console.error("Cover update failed:", error);
    },
  });
};

export const useEditUser = () => {
  const queryClient = useQueryClient();

  // TODO: Improve type safety by adding proper types like UserResponse, UserUpdateData, and UserData
  return useMutation({
    mutationFn: editUserRequest,

    onSuccess: (data) => {
      console.log("User updated successfully:", data);

      queryClient.setQueryData(["user"], (oldData: {}) => ({
        ...oldData,
        ...data, // Merge the updated data with the existing data
      }));
      queryClient.invalidateQueries({
        // Pass the specific type of filter object to invalidateQueries
        queryKey: ["user", data.id],
      });
    },
    onError: (error) => {
      console.error("Userdate failed:", error.message);
    },
  });
};

export const useChangePassword = () => {
  return useMutation<
    void,
    Error,
    { currentPassword: string; newPassword: string }
  >({
    mutationFn: changePasswordRequest,

    onError: (error) => {
      console.error("Change password failed:", error);
      // Error handled via notifyError and local state in the form
    },
  });
};
