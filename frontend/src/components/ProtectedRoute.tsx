import { useAuth } from "../context/AuthContext";
import { LoadingSpinner } from "./LoadingSpinner";
import { Navigate, useLocation } from "react-router-dom";

export const ProtectedRoute = ({ element }: { element: JSX.Element }) => {
  const { isLoggedIn, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user && location.pathname === "/profile") return <Navigate to={`/profile/${user.id}`} replace />;

  return element;
};
