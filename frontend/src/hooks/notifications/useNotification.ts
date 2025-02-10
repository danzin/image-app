import { useEffect, useState } from "react";
import { useSocket } from "../../context/SocketContext";

interface Notification {
  _id: string;
  actionType: string;
  actorId: string;
  targetId?: string;
  timestamp: string;
  isRead: boolean;
}

export const useNotifications = () => {
  const socket = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on("new_notification", (notification: Notification) => {
      console.log("New notification received:", notification);
      setNotifications((prev) => [notification, ...prev]); 
    });

    return () => {
      socket.off("new_notification");
    };
  }, [socket]);

  return { notifications };
};
