import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "../../api/userApi";
import { AuthenticatedUserDTO } from "../../types";
import { toast } from "react-toastify";
import { useAuth } from "../context/useAuth";

type RegisterResponse = { user: AuthenticatedUserDTO; token: string };

export const useRegister = () => {
	const { login: setAuthUser } = useAuth();

	return useMutation<RegisterResponse, Error, { username: string; email: string; password: string }>({
		mutationFn: registerRequest,

		onSuccess: (data) => {
			setAuthUser(data.user);
			toast.success("Registration successful! You are now logged in.");
		},

		onError: (error) => {
			toast.error(`Registration failed: ${error.message || "Could not create account"}`);
			console.error("Registration mutation failed:", error);
		},
	});
};
