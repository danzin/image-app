import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { loginRequest } from "../../api/userApi";

export const useLogin = () => {
  const { login, checkAuthState } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: loginRequest,
    onSuccess: async (data) => {
      login(data);
      // Refresh auth state 
      await checkAuthState();
      // Invalidate queries
      await queryClient.invalidateQueries();
    },
  });
};