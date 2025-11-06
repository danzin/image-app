import { ReactNode, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axiosClient from "../../api/axiosClient";
import { AuthContext } from "./AuthContext";
import { AuthenticatedUserDTO, AdminUserDTO } from "../../types";

interface AuthProviderProps {
	children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
	const [error, setError] = useState<string | null>(null);
	const queryClient = useQueryClient();

	const login = useCallback(
		(userData: AuthenticatedUserDTO | AdminUserDTO) => {
			queryClient.setQueryData(["currentUser"], userData);
			setError(null);
		},
		[queryClient]
	);

	const logout = useCallback(async () => {
		try {
			setError(null);
			await axiosClient.post("/api/users/logout");
		} catch {
			setError("Logout failed");
		} finally {
			queryClient.setQueryData(["currentUser"], null);
			queryClient.clear();
		}
	}, [queryClient]);

	const value = { login, logout, error };

	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
