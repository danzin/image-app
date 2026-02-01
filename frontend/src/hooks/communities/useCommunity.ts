import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	fetchCommunity,
	createCommunity,
	joinCommunity,
	leaveCommunity,
	kickMember,
	updateCommunity,
} from "../../api/communityApi";
import { CreateCommunityDTO, UpdateCommunityDTO } from "../../types";
import { toast } from "react-toastify";
import { AxiosError } from "axios";

export const useCommunity = (slug?: string) => {
	return useQuery({
		queryKey: ["community", slug],
		queryFn: () => fetchCommunity(slug!),
		enabled: !!slug,
	});
};

export const useCreateCommunity = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: CreateCommunityDTO) => createCommunity(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["communities"] });
			toast.success("Community created successfully!");
		},
		onError: (error: AxiosError<{ message?: string }>) => {
			toast.error(error.response?.data?.message || "Failed to create community");
		},
	});
};

export const useUpdateCommunity = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ communityId, updates }: { communityId: string; updates: UpdateCommunityDTO }) =>
			updateCommunity(communityId, updates),
		onSuccess: (data) => {
			queryClient.invalidateQueries({ queryKey: ["community", data.slug] });
			queryClient.invalidateQueries({ queryKey: ["communities"] });
			toast.success("Community updated successfully!");
		},
		onError: (error: AxiosError<{ message?: string }>) => {
			toast.error(error.response?.data?.message || "Failed to update community");
		},
	});
};

export const useJoinCommunity = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (communityId: string) => joinCommunity(communityId),
		onSuccess: (_data, communityId) => {
			queryClient.invalidateQueries({ queryKey: ["community"] });
			queryClient.invalidateQueries({ queryKey: ["community-posts", communityId] });
			queryClient.invalidateQueries({ queryKey: ["community-members"] });
			queryClient.invalidateQueries({ queryKey: ["communities"] });
			queryClient.invalidateQueries({ queryKey: ["user-communities"] });
			toast.success("Joined community!");
		},
		onError: (error: AxiosError<{ message?: string }>) => {
			toast.error(error.response?.data?.message || "Failed to join community");
		},
	});
};

export const useLeaveCommunity = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (communityId: string) => leaveCommunity(communityId),
		onSuccess: (_data, communityId) => {
			queryClient.invalidateQueries({ queryKey: ["community"] });
			queryClient.invalidateQueries({ queryKey: ["community-posts", communityId] });
			queryClient.invalidateQueries({ queryKey: ["community-members"] });
			queryClient.invalidateQueries({ queryKey: ["communities"] });
			queryClient.invalidateQueries({ queryKey: ["user-communities"] });
			toast.success("Left community");
		},
		onError: (error: AxiosError<{ message?: string }>) => {
			toast.error(error.response?.data?.message || "Failed to leave community");
		},
	});
};

export const useKickMember = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ communityId, userId }: { communityId: string; userId: string }) => kickMember(communityId, userId),
		onSuccess: (_data, variables) => {
			queryClient.invalidateQueries({ queryKey: ["community-members"] });
			queryClient.invalidateQueries({ queryKey: ["community", variables.communityId] });
			toast.success("Member kicked successfully");
		},
		onError: (error: AxiosError<{ message?: string }>) => {
			toast.error(error.response?.data?.message || "Failed to kick member");
		},
	});
};
