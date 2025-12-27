import { useMutation } from "@tanstack/react-query";
import { resetPassword } from "../../api/userApi";

export const useResetPassword = () => {
	return useMutation<void, Error, { token: string; newPassword: string }>({
		mutationFn: resetPassword,
	});
};
