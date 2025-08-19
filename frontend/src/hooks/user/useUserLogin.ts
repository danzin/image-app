import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginRequest } from "../../api/userApi";
import { AdminUserDTO, PublicUserDTO } from "../../types";
import { toast } from "react-toastify";
import { useAuth } from "../context/useAuth";

type LoginResponse = { user: PublicUserDTO | AdminUserDTO; token: string };

export const useLogin = () => {
	const queryClient = useQueryClient();
	const { login: setAuthUser } = useAuth();

	return useMutation<LoginResponse, Error, { email: string; password: string }>({
		mutationFn: loginRequest,

		onSuccess: (data) => {
			// Update the global authentication state using the context function
			setAuthUser(data.user);

			// Invalidate queries - use publicId instead of id
			queryClient.invalidateQueries({ queryKey: ["user", data.user.publicId] });
			queryClient.invalidateQueries({ queryKey: ["userImages", data.user.publicId] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });

			// Success toast
			toast.success("Login successful!");
		},

		onError: (error) => {
			// Error toast
			console.log(error);
			toast.error(`Login failed: ${error.message || "Invalid credentials or server error"}`);
			console.error("Login mutation failed:", error);
		},
	});
};
