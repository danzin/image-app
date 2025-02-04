import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { registerRequest } from "../api/userApi";

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