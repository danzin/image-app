import { useMutation } from "@tanstack/react-query";
import { requestPasswordReset } from "../../api/userApi";

export const useForgotPassword = () => {
	return useMutation<void, Error, { email: string }>({
		mutationFn: requestPasswordReset,
	});
};
