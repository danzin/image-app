import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuth } from '../hooks/context/useAuth';

export const AdminRoute = ({ element }: { element: JSX.Element }) => {
  const { user, loading } = useAuth();

   if (loading) return <LoadingSpinner />; 
  
  if (!user || !user.isAdmin) {
    return <Navigate to="/login" />;
  }

  return element;
};
