import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketContext } from './SocketContext';
import { useAuth } from '../../hooks/context/useAuth';

interface SocketProviderProps {
  children: React.ReactNode;
}
export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const { user, isLoggedIn } = useAuth();

  // Avoid re-render every time the socket is set
  const socketRef = useRef<Socket | null>(null);
  const [, setReady] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    const base = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || window.location.origin;
    const socketUrl = base.replace(/\/$/, '');
    const token = localStorage.getItem('token');
    const socket = io(socketUrl, {
      path: '/socket.io',
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelayMax: 10000,
      auth: token ? { token } : undefined,
    });

    // Connect
    const handleConnect = () => {
      console.log('Socket connected');
      socket.emit('join', user.publicId);
      setReady(true);
    };

    // Error
    const handleError = (err: Error) => {
      console.error('Socket connection error:', err);
    };

    // Disconnect
    const handleDisconnect = (reason: string) => {
      console.warn('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    };
    const handleNotification = (msg: unknown) => {
      console.info('New notification (raw listener):', msg);
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleError);
    socket.on('disconnect', handleDisconnect);
    socket.on('new_notification', handleNotification);
   
    // Store and explicitly connect
    socketRef.current = socket;
    socket.connect();

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleError);
      socket.off('disconnect', handleDisconnect);
      socket.off('new_notification', handleNotification);
      socket.disconnect();
    };
  }, [isLoggedIn, user, user?.publicId]);

  return <SocketContext.Provider value={socketRef.current}>{children}</SocketContext.Provider>;
};