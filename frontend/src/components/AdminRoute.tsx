import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './LoadingSpinner';

export const AdminRoute = ({ element }: { element: JSX.Element }) => {
  const { user, loading } = useAuth();

   if (loading) return <LoadingSpinner />; 
  
  if (!user || !user.isAdmin) {
    return <Navigate to="/login" />;
  }

  return element;
};
