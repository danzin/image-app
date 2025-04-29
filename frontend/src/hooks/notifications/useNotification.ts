import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  markNotificationAsRead,
} from "../../api/notificationApi";
import { Notification } from "../../types";
import { useSocket } from "../context/useSocket";

export const useNotifications = () => {
  const socket = useSocket();
  const queryClient = useQueryClient();

  const { data: raw = [] } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const notifications = useMemo(
    () =>
      [...raw].sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [raw]
  );

  // Mark notification as read mutation
  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    // Optimistic update
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["notifications"] });
      const previous = queryClient.getQueryData<Notification[]>([
        "notifications",
      ]);
      queryClient.setQueryData<Notification[]>(
        ["notifications"],
        (old) =>
          old?.map((n) => (n.id === id ? { ...n, isRead: true } : n)) ?? []
      );
      return { previous };
    },
    onError: (_err, _id, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["notifications"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Handle real-time notifications with WebSocket
  useEffect(() => {
    if (!socket) return;
    const handleNew = (notification: Notification) => {
      console.log("New notification received:", notification);
      queryClient.setQueryData(
        ["notifications"],
        (oldNotifications: Notification[] = []) => [
          notification,
          ...oldNotifications,
        ]
      );
    };

    const handleRead = (updatedNotification: Notification) => {
      console.log("Notification marked as read:", updatedNotification);
      queryClient.setQueryData(
        ["notifications"],
        (oldNotifications: Notification[] = []) =>
          oldNotifications.map((notif) =>
            notif.id === updatedNotification.id ? updatedNotification : notif
          )
      );
    };

    //Listen for new notifications
    socket.on("new_notification", handleNew);

    // Listen for notifications marked as read
    socket.on("notification_read", handleRead);

    return () => {
      socket.off("new_notification", handleNew);
      socket.off("notification_read", handleRead);
    };
  }, [socket, queryClient]);

  return {
    notifications,
    markAsRead: (id: string) => markReadMutation.mutate(id),
  };
};
