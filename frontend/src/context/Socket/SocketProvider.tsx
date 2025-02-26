import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SocketContext } from './SocketContext';
import { useAuth } from '../../hooks/context/useAuth';

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoggedIn } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    const newSocket = io('http://localhost:3000', {
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
      newSocket.emit('join', user.id);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isLoggedIn, user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};