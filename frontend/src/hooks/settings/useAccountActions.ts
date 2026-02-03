import { useMutation } from "@tanstack/react-query";
import { changePasswordRequest, deleteAccountRequest } from "../../api/userApi";
import { useAuth } from "../context/useAuth";

interface ChangePasswordPayload {
	currentPassword: string;
	newPassword: string;
}

export const useChangePassword = () => {
	return useMutation({
		mutationFn: (payload: ChangePasswordPayload) => changePasswordRequest(payload),
	});
};

export const useDeactivateAccount = () => {
	const { logout } = useAuth();

	return useMutation({
		mutationFn: (payload: { password: string }) => deleteAccountRequest(payload.password),
		onSuccess: () => {
			logout();
			window.location.href = "/";
		},
	});
};
