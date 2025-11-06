import { useContext } from "react";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useCurrentUser } from "../user/useUsers";

export const useAuth = () => {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error("useAuth must be used within an AuthProvider");
	}

	const { data: user, isLoading, error: queryError } = useCurrentUser();

	return {
		...context,
		user: user || null,
		isLoggedIn: !!user,
		loading: isLoading,
		error: context.error || queryError?.message || null,
	};
};
