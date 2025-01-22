import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import axiosClient from '../api/axiosClient';
import { AuthContextData, IUser } from '../types';


//Initialize context with default values
const AuthContext = createContext<AuthContextData | undefined>(undefined);

function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true); // Track loading

  useEffect(() => {
    const token = localStorage.getItem('token');
    //Check if token exists in local storage
    if (token) {
      //Validate token with backend
      //Backend will respond with an error if token is invalid
      axiosClient
        .get('/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((response) => {
          setUser(response.data);
          setIsLoggedIn(true);
        })
        .catch(() => {
          localStorage.removeItem('token'); //Clear invadlid token
        })
        .finally(() => {
          setLoading(false); //Set loading to false
        });
    } else {
      setLoading(false); //No need to fetch because there's no token
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

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout }}>
      {!loading ? children : <div>Loading...</div>} {/* Show loading state */}
    </AuthContext.Provider>
  );
}


//Custom hook for AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
