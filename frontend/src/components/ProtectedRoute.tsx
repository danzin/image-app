import { useAuth } from "../context/AuthContext";
import { LoadingSpinner } from "./LoadingSpinner"; 
import { Navigate } from "react-router-dom"; 

export const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isLoggedIn, loading } = useAuth();

  if (loading) return <LoadingSpinner />; 
  if (!isLoggedIn) return <Navigate to="/login" replace />;

  return children;
};