import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginRequest } from "../../api/userApi";
import { AdminUserDTO, PublicUserDTO } from "../../types";
import { toast } from "react-toastify";
import { useAuth } from "../context/useAuth";

type LoginSuccessData = PublicUserDTO | AdminUserDTO;

export const useLogin = () => {
  const queryClient = useQueryClient();
  const { login: setAuthUser } = useAuth();

  return useMutation<
    LoginSuccessData,
    Error,
    { email: string; password: string }
  >({
    mutationFn: loginRequest,

    onSuccess: (data) => {
      // Update the global authentication state using the context function
      setAuthUser(data);

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["user", data.id] });
      queryClient.invalidateQueries({ queryKey: ["userImages", data.id] });
      queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });

      // Success toast
      toast.success("Login successful!");
    },

    onError: (error) => {
      //Rrror toast
      toast.error(
        `Login failed: ${
          error.message || "Invalid credentials or server error"
        }`
      );
      console.error("Login mutation failed:", error);
    },
  });
};
