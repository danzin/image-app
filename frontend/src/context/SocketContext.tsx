import { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext<Socket | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoggedIn } = useAuth(); 
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    const newSocket = io("http://localhost:12000", {  
      withCredentials: true,
    });


    newSocket.on("connect", () => {
      console.log("Connected to WebSocket");
      newSocket.emit("join", user.id);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isLoggedIn, user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
