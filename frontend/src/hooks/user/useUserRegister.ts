import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "../../api/userApi";
import { useAuth } from "../context/useAuth";

export const useRegister = () => {
  const { checkAuthState } = useAuth();

  return useMutation({
    mutationFn: registerRequest,
    onSuccess: async () => {
      // After registration, check auth state automatically
      await checkAuthState();
    },
  });
};