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
	fetchUserImages,
	updateUserAvatar as updateUserAvatarApi,
	updateUserCover as updateUserCoverApi,
} from "../../api/userApi";
import { ImagePageData, PublicUserDTO, AuthenticatedUserDTO, AdminUserDTO } from "../../types";
import { editUserRequest, changePasswordRequest } from "../../api/userApi";

type UseUserImagesOptions = Omit<
	UseInfiniteQueryOptions<ImagePageData, Error, InfiniteData<ImagePageData, number>>,
	"queryKey" | "queryFn" | "initialPageParam" | "getNextPageParam"
>;

// Get current authenticated user /me
export const useCurrentUser = () => {
	return useQuery<AuthenticatedUserDTO | AdminUserDTO>({
		queryKey: ["currentUser"],
		queryFn: ({ signal }) => fetchCurrentUser(signal),
		staleTime: 6000,
	});
};

// Get user by public ID
export const useGetUserByPublicId = (publicId: string | undefined) => {
	return useQuery<PublicUserDTO>({
		queryKey: ["user", "publicId", publicId],
		queryFn: ({ queryKey }) => fetchUserByPublicId({ queryKey: [queryKey[0] as string, queryKey[2] as string] }),
		enabled: !!publicId,
		staleTime: 60000,
	});
};

// Get user by username
export const useGetUserByUsername = (username: string | undefined) => {
	return useQuery<PublicUserDTO>({
		queryKey: ["user", "username", username],
		queryFn: ({ queryKey }) => fetchUserByUsername({ queryKey: [queryKey[0] as string, queryKey[2] as string] }),
		enabled: !!username,
		staleTime: 60000,
	});
};

// For backward compatibility - tries to determine if it's a publicId or username
export const useGetUser = (identifier: string | undefined) => {
	// Check if identifier looks like a UUID (publicId)
	const isPublicId = identifier && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);

	return useQuery<PublicUserDTO>({
		queryKey: ["user", identifier],
		queryFn: ({ queryKey }) => {
			const id = queryKey[1] as string;
			if (isPublicId) {
				return fetchUserByPublicId({ queryKey: ["user", id] });
			}
			return fetchUserByUsername({ queryKey: ["user", id] });
		},
		enabled: !!identifier,
		staleTime: 60000,
	});
};

// Get user images by user public ID
export const useUserImages = (userPublicId: string, options?: UseUserImagesOptions) => {
	return useInfiniteQuery({
		queryKey: ["userImages", userPublicId] as const,
		queryFn: ({ pageParam = 1 }) => fetchUserImages(pageParam as number, userPublicId),
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
			// Update current user cache
			queryClient.setQueryData(["currentUser"], data);
			// Invalidate user-related queries
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
	return useMutation<AuthenticatedUserDTO | AdminUserDTO, Error, Blob>({
		mutationFn: updateUserCoverApi,
		onSuccess: (data) => {
			// Update current user cache
			queryClient.setQueryData(["currentUser"], data);
			// Invalidate user-related queries
			queryClient.invalidateQueries({ queryKey: ["user"] });
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

			// Update current user cache
			queryClient.setQueryData(["currentUser"], data);

			// Invalidate user queries using publicId
			queryClient.invalidateQueries({
				queryKey: ["user", "publicId", data.publicId],
			});
			queryClient.invalidateQueries({
				queryKey: ["user", "username", data.username],
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
			// Error handled via notifyError and local state in the form
		},
	});
};
