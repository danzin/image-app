import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../../context/SocketContext";
import { fetchNotifications, markNotificationAsRead } from "../../api/notificationApi";

interface Notification {
  id: string;
  userId: string;
  actionType: string;
  actorId: {
    id: string;
    username: string;
  };
  targetId?: string;
  timestamp: string;
  isRead: boolean;
}

export const useNotifications = () => {
  const socket = useSocket();
  const queryClient = useQueryClient();


  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    staleTime: 5 * 60 * 1000, 
    refetchOnMount: true, 
    refetchOnWindowFocus: false, 
  });

  // Mark notification as read mutation
  const { mutate: markAsRead } = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: (updatedNotification) => {
      // Update cache without refetching
      queryClient.setQueryData(['notifications'], (oldNotifications: Notification[] = []) =>
        oldNotifications.map((notif) =>
          notif.id === updatedNotification.id ? updatedNotification : notif
        )
      );
    },
    onError: (error: any) => {
      console.error('Error marking notification as read:', error);
    },
  });

  // Handle real-time notifications with WebSocket
  useEffect(() => {
    if (!socket) return;

    //Listen for new notifications
    socket.on('new_notification', (notification: Notification) => {
      console.log('New notification received:', notification);
      queryClient.setQueryData(['notifications'], (oldNotifications: Notification[] = []) => [
        notification,
        ...oldNotifications,
      ]);
    });

    // Listen for notifications marked as read
    socket.on('notification_read', (updatedNotification: Notification) => {
      console.log('Notification marked as read:', updatedNotification);
      queryClient.setQueryData(['notifications'], (oldNotifications: Notification[] = []) =>
        oldNotifications.map((notif) =>
          notif.id === updatedNotification.id ? updatedNotification : notif
        )
      );
    });

    return () => {
      socket.off('new_notification');
      socket.off('notification_read');
    };
  }, [socket, queryClient]);

  return { notifications, markAsRead };
};
