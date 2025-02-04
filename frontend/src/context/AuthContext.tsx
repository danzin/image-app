import { createContext, useState, ReactNode, useContext, useEffect, useCallback } from 'react';
import axiosClient from '../api/axiosClient';
import { AuthContextData, IUser } from '../types';
import { useQueryClient } from '@tanstack/react-query';

const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true); 
  const queryClient = useQueryClient(); 

  const checkAuthState = useCallback(async () => {
    try {
      const { data } = await axiosClient.get<IUser>('/users/me');
      setUser(data);
    } catch (error) {
      setUser(null);
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
      await axiosClient.post('/users/logout');
    } finally {
      setUser(null);
      // Clear any cached queries
      queryClient.clear(); 
    }
  }, []);


 
  const value = {
    user,
    isLoggedIn: !!user,
    login,
    logout,
    checkAuthState, 
    loading
  };

  return (
    <AuthContext.Provider value={ value }>
      {loading ? <div>Loading...</div> : children}
    </AuthContext.Provider>
  );
}
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
