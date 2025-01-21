import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ element }: { element: JSX.Element }) => {
  const { user } = useAuth(); //User from authcontext

  if (user === null) {
    //Redirect to login if not authenticated
    return <Navigate to="/login" />;
  }

  //Proceed with the protected element
  return element;
};
