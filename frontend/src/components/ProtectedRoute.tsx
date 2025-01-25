import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ element }: { element: JSX.Element }) => {
  const { user } = useAuth(); 
  if (user === null) {
    return <Navigate to="/login" />;
  }

  return element;
};
