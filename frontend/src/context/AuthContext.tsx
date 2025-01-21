import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { IUser } from '../types';

interface AuthContextData {
  isLoggedIn: boolean;
  user: IUser | null;
  login: (user: IUser, token: string) => void;
  logout: () => void;

}

const AuthContext = createContext<AuthContextData>({
  isLoggedIn: false,
  user: null,
  login: () => {},
  logout: () => {},

  
});

function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<IUser | null>(null);
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axiosClient
        .get('/api/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setUser(response.data);
          setIsLoggedIn(true);
        })
        .catch(() => {
          localStorage.removeItem('token');
        });
    }
  }, []);

  const login = async (user: IUser, token: string) => {
    setUser(user);
    localStorage.setItem('token', token);
    setIsLoggedIn(true);
  };


  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
    setIsLoggedIn(false);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {children}
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