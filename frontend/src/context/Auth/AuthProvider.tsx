import { useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import axiosClient from '../../api/axiosClient';
import { AuthContext } from './AuthContext';
import { IUser } from '../../types';
import { fetchCurrentUser } from '../../api/userApi';
import axios from 'axios';

interface AuthProviderProps { children: ReactNode }

export default function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const checkAuthState = useCallback(async () => {
    // Cancel any previous /me request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const start = performance.now();
    setLoading(true);
    try {
      setError(null);
      const data = await fetchCurrentUser(controller.signal);
      setUser(data as IUser);
    } catch (err) {
      if (typeof err === 'object' && err && 'name' in err && (err as { name?: unknown }).name === 'CanceledError') return;
      const markAnonymous = () => { setUser(null); setError(null); };
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        const timeout = err.code === 'ECONNABORTED';
        const duration = Math.round(performance.now() - start);
        console.warn('[Auth] /me failed', { status, code: err.code, duration });
        if (status === 401 || status === 403) {
          markAnonymous();
        } else if (timeout) {
          setUser(null);
          setError('Session check timed out');
        } else {
            // Only show error for non-auth failures
            setUser(null);
            setError('Failed to verify session');
        }
      } else if (typeof err === 'object' && err && 'message' in err && (err as { message?: unknown }).message === 'UNAUTHORIZED') {
        markAnonymous();
      } else {
        console.error('[Auth] Unexpected error', err);
        setUser(null);
        // Treat unknown error as non-fatal so public pages still render
        setError(null);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const login = useCallback((data: IUser) => {
    setUser(data);
    setError(null);
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      await axiosClient.post('/api/users/logout');
    } catch {
      setError('Logout failed');
    } finally {

      setUser(null);
    }
  }, []);

  useEffect(() => {
    checkAuthState();
    return () => abortRef.current?.abort();
  }, [checkAuthState]);

  const value = { user, isLoggedIn: !!user, login, logout, checkAuthState, loading, error };

  return (
    <AuthContext.Provider value={value}>
      {loading ? <div>Loading...</div> : children}
    </AuthContext.Provider>
  );
}