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
	fetchUserByPublicId,
	fetchUserByUsername,
	fetchUserPosts,
	fetchUserLikedPosts,
	fetchUserComments,
	updateUserAvatar as updateUserAvatarApi,
	updateUserCover as updateUserCoverApi,
} from "../../api/userApi";
import { ImagePageData, PublicUserDTO, AuthenticatedUserDTO, AdminUserDTO } from "../../types";
import { editUserRequest, changePasswordRequest } from "../../api/userApi";

type UseUserImagesOptions = Omit<
	UseInfiniteQueryOptions<ImagePageData, Error, InfiniteData<ImagePageData, number>>,
	"queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

type UseUserCommentsOptions = Omit<
	UseInfiniteQueryOptions<
		{ comments: unknown[]; total: number; page: number; limit: number; totalPages: number },
		Error,
		InfiniteData<{ comments: unknown[]; total: number; page: number; limit: number; totalPages: number }, number>
	>,
	"queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

// Get current authenticated user at /me
export const useCurrentUser = () => {
	return useQuery<AuthenticatedUserDTO | AdminUserDTO>({
		queryKey: ["currentUser"],
		queryFn: ({ signal }) => fetchCurrentUser(signal),
		staleTime: 6000,
	});
};

export const useGetUserByPublicId = (publicId: string | undefined) => {
	return useQuery<PublicUserDTO>({
		queryKey: ["user", "publicId", publicId],
		queryFn: ({ queryKey }) => fetchUserByPublicId({ queryKey: [queryKey[0] as string, queryKey[2] as string] }),
		enabled: !!publicId,
		staleTime: 60000,
	});
};

export const useGetUserByUsername = (username: string | undefined) => {
	return useQuery<PublicUserDTO>({
		queryKey: ["user", "username", username],
		queryFn: ({ queryKey }) => fetchUserByUsername({ queryKey: [queryKey[0] as string, queryKey[2] as string] }),
		enabled: !!username,
		staleTime: 60000,
	});
};

export const useGetUser = (identifier: string | undefined) => {
	const queryClient = useQueryClient();

	const currentUser = queryClient.getQueryData<AuthenticatedUserDTO | AdminUserDTO>(["currentUser"]);
	const isViewingSelf = currentUser?.publicId === identifier || currentUser?.username === identifier;
	const isPublicId = identifier && /^[0-9a-f]{8}-[0-9a-f]{4}-.../.test(identifier);

	return useQuery<PublicUserDTO>({
		queryKey: ["user", identifier],
		queryFn: () => {
			const freshCurrentUser = queryClient.getQueryData<AuthenticatedUserDTO | AdminUserDTO>(["currentUser"]);
			const isSelf = freshCurrentUser?.publicId === identifier || freshCurrentUser?.username === identifier;

			if (isSelf && freshCurrentUser) {
				return Promise.resolve(freshCurrentUser as PublicUserDTO);
			}

			return isPublicId
				? fetchUserByPublicId({ queryKey: ["user", identifier!] })
				: fetchUserByUsername({ queryKey: ["user", identifier!] });
		},
		enabled: !!identifier,
		staleTime: isViewingSelf ? 0 : 60000,
	});
};

export const useUserPosts = (userPublicId: string, options?: UseUserImagesOptions) => {
	return useInfiniteQuery({
		queryKey: ["userPosts", userPublicId] as const,
		queryFn: ({ pageParam = 1 }) => fetchUserPosts(pageParam as number, userPublicId),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		...options,
	});
};

export const useUserLikedPosts = (userPublicId: string, options?: UseUserImagesOptions) => {
	return useInfiniteQuery({
		queryKey: ["userLikedPosts", userPublicId] as const,
		queryFn: ({ pageParam = 1 }) => fetchUserLikedPosts(pageParam as number, userPublicId),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		...options,
	});
};

export const useUserComments = (userPublicId: string, options?: UseUserCommentsOptions) => {
	return useInfiniteQuery({
		queryKey: ["userComments", userPublicId] as const,
		queryFn: ({ pageParam = 1 }) => fetchUserComments(pageParam as number, userPublicId),
		initialPageParam: 1,
		getNextPageParam: (lastPage) => (lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined),
		...options,
	});
};

export const useUpdateUserAvatar = () => {
	const queryClient = useQueryClient();
	return useMutation<AuthenticatedUserDTO | AdminUserDTO, Error, Blob>({
		mutationFn: updateUserAvatarApi,
		onSuccess: (data) => {
			queryClient.setQueryData(["currentUser"], data);
			queryClient.setQueryData(["user", data.publicId], data);
			queryClient.setQueryData(["user", "publicId", data.publicId], data);
			queryClient.setQueryData(["user", "username", data.username], data);

			queryClient.invalidateQueries({ queryKey: ["userPosts", data.publicId] });
		},
		onError(error) {
			console.error("Avatar update failed:", error);
		},
	});
};

export const useUpdateUserCover = () => {
	const queryClient = useQueryClient();
	return useMutation<AuthenticatedUserDTO | AdminUserDTO, Error, Blob>({
		mutationFn: updateUserCoverApi,
		onSuccess: (data) => {
			queryClient.setQueryData(["currentUser"], data);
			queryClient.setQueryData(["user", data.publicId], data);
			queryClient.setQueryData(["user", "publicId", data.publicId], data);
			queryClient.setQueryData(["user", "username", data.username], data);

			queryClient.invalidateQueries({ queryKey: ["userPosts", data.publicId] });
		},
		onError: (error) => {
			console.error("Cover update failed:", error);
		},
	});
};

export const useEditUser = () => {
	const queryClient = useQueryClient();

	return useMutation<AuthenticatedUserDTO | AdminUserDTO, Error, { username?: string; bio?: string }>({
		mutationFn: editUserRequest,

		onSuccess: (data) => {
			console.log("User updated successfully:", data);

			queryClient.setQueryData(["currentUser"], data);

			// Invalidate all user  queries
			queryClient.invalidateQueries({
				queryKey: ["user"],
			});
		},
		onError: (error) => {
			console.error("User update failed:", error.message);
		},
	});
};

export const useChangePassword = () => {
	return useMutation<void, Error, { currentPassword: string; newPassword: string }>({
		mutationFn: changePasswordRequest,

		onError: (error) => {
			console.error("Change password failed:", error);
		},
	});
};
