import { useState, ReactNode, useEffect, useCallback } from 'react';
import axiosClient from '../../api/axiosClient';
import { AuthContext } from './AuthContext';
import { IUser } from '../../types';

interface AuthProviderProps {
  children: ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // [checkAuthState] is a dependency in the useEffect hook below.
  // Without useCallaback, checkAuthState would be recreated on every render, causing the 
  // useEffect to run unnecessary because it's dependency would change.
  // useCallback memoizes checkAuthState, ensuring the same function instance is reused,
  // and useEffect only runs once on mount. 
  // It has an empty dependency array because it doesn't need to change unless thse component mounts/unmounts. 
  const checkAuthState = useCallback(async () => {
    try {
      setError(null);
      const { data } = await axiosClient.get<IUser>('/api/users/me');
      setUser(data);
    } catch (error: any) {
      console.log(error);
      if (error.code === 403) {
        setUser(null);
      } else {
        // setError('An unexpected error occurred. Please try again later.');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  // The login function is part of the value obj. passed to AuthContext.Provider.
  // Without useCallback, login would be a new function on every render, causing the value object  to be a new object
  // every time. This triggers unnecessary re-renders in components consuming the context. 
  // Memoizing it makes sure the same function reference is reused, optimizing performance. 
  const login = useCallback((userData: IUser) => {
    setUser(userData);
  }, []);

  // Similar to login, logout is part of the value object and memoizing it with useCallback prevents unnecessary re-renders. 
  // It just keeps the function reference stable across renders.
  // Mepty dependency array because it relies on setUser, which is stable. 
  const logout = useCallback(async () => {
    try {
      setError(null);
      await axiosClient.post('/api/users/logout');
  } catch (error: any) {
      setError('Logout failed. Please try again.');
    } finally {
      setUser(null);
    }
  }, []);

  const value = {
    user,
    isLoggedIn: !!user,
    login,
    logout,
    checkAuthState,
    loading,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div>Loading...</div> : error ? <div>{error}</div> : children}
    </AuthContext.Provider>
  );
}