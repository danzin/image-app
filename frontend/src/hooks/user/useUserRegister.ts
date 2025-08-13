import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "../../api/userApi";
import { PublicUserDTO } from "../../types";
import { toast } from "react-toastify";

type RegisterResponse = { user: PublicUserDTO; token: string };

export const useRegister = () => {
	return useMutation<RegisterResponse, Error, { username: string; email: string; password: string }>({
		mutationFn: registerRequest,

		onSuccess: (data) => {
			// Store the token in localStorage after successful registration
			localStorage.setItem("token", data.token);

			// Registration successful - user is automatically logged in
			toast.success("Registration successful! You are now logged in.");
		},

		onError: (error) => {
			toast.error(`Registration failed: ${error.message || "Could not create account"}`);
			console.error("Registration mutation failed:", error);
		},
	});
};
