import { createContext, useState, ReactNode, useContext, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { AuthContextData, IUser } from '../types';

// Initialize context with default values
const AuthContext = createContext<AuthContextData | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

function AuthProvider({ children }: AuthProviderProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Track loading

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axiosClient
        .get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setUser(response.data);
          setIsLoggedIn(true);
        })
        .catch(() => {
          localStorage.removeItem('token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = (user: IUser, token: string) => {
    setUser(user);
    localStorage.setItem('token', token);
    setIsLoggedIn(true);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  // Make sure to pass the correct values to the context
  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, setUser }}>
      {!loading ? children : <div>Loading...</div>}
    </AuthContext.Provider>
  );
}

// Custom hook to access AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
