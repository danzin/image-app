import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import { useAuth } from '../hooks/context/useAuth';
import { AdminUserDTO, IUser } from '../types';

/* 
  'user is AdminUserDTO' is a type predicate signature that tells TS "if this fn returns true, 
  then user is definitely AdminUserDTO"
*/
function isAdminUser(user: IUser | null): user is AdminUserDTO { 

  /*'
    "!!user" makes sure user is not null 
    casting "user" to "any" bypasses compile-time checks, allowing access to .isAdmin at runtime, regardless of which union member it is.
    " typeof (user as any).isAdmin === 'boolean' " checks that there is an 'isAdmin' property that is actually a boolean.
    
    Basically, this makes sure that the user isn't nullish and the flag exists and is the right type(boolean)
   */
  return !!user && 'isAdmin' in user && typeof user.isAdmin === 'boolean';
}


export const AdminRoute = ({ element }: { element: JSX.Element }) => {
  const { user , loading } = useAuth();

   if (loading) return <LoadingSpinner />; 
  
  if (!isAdminUser(user) || !user.isAdmin) {
    return <Navigate to="/login" />;
  }

  return element;
};
