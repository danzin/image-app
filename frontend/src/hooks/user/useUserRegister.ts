import { useMutation } from "@tanstack/react-query";
import { registerRequest } from "../../api/userApi";
import { PublicUserDTO } from "../../types";
import { toast } from "react-toastify";

type RegisterSuccessData = { user: PublicUserDTO; token: string };

export const useRegister = () => {
  return useMutation<
    RegisterSuccessData,
    Error,
    { username: string; email: string; password: string }
  >({
    mutationFn: registerRequest,

    onSuccess: (_data) => {
      toast.success("Registration successful! Please log in.");
    },

    onError: (error) => {
      toast.error(
        `Registration failed: ${error.message || "Could not create account"}`
      );
      console.error("Registration mutation failed:", error);
    },
  });
};
