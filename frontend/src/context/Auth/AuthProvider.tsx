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

  const checkAuthState = useCallback(async () => {
    try {
      setError(null);
      const { data } = await axiosClient.get<IUser>('/users/me');
      setUser(data);
    } catch (error: any) {
      console.log(error);
      if (error.code === 403) {
        setUser(null);
      } else {
        setError('An unexpected error occurred. Please try again later.');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  const login = useCallback((userData: IUser) => {
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      await axiosClient.post('/users/logout');
    } catch (error) {
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