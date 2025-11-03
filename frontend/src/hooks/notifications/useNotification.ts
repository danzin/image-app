import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from "@tanstack/react-query";
import { fetchNotifications, markNotificationAsRead } from "../../api/notificationApi";
import { Notification } from "../../types";
import { useSocket } from "../context/useSocket";

export const useNotifications = () => {
	const socket = useSocket();
	const queryClient = useQueryClient();

	// use infinite query for cursor-based pagination
	const notificationsQuery = useInfiniteQuery<Notification[]>({
		queryKey: ["notifications"],
		queryFn: ({ signal, pageParam }) => {
			// pageParam is the timestamp cursor for pagination
			return fetchNotifications(signal, pageParam as string | undefined);
		},
		initialPageParam: undefined, // first page has no cursor
		getNextPageParam: (lastPage) => {
			// if there are less notifications than requested, there are no more pages
			if (!lastPage || lastPage.length === 0 || lastPage.length < 20) {
				return undefined;
			}

			// use the timestamp of the oldest notification as cursor for next page
			const oldestNotification = lastPage[lastPage.length - 1];
			return oldestNotification?.timestamp;
		},
		staleTime: 5 * 60_000, // 5 minutes
		gcTime: 10 * 60_000, // 10 minutes
		refetchOnWindowFocus: false,
		refetchOnMount: false, // prevent refetch on component mount if data exists
	});

	// flatten all pages into single array
	const notifications = useMemo(() => {
		if (!notificationsQuery.data) return [];
		return notificationsQuery.data.pages.flat();
	}, [notificationsQuery.data]);

	// Mark notification as read mutation
	const markReadMutation = useMutation({
		mutationFn: (id: string) => markNotificationAsRead(id),
		// Optimistic update
		onMutate: async (id: string) => {
			await queryClient.cancelQueries({ queryKey: ["notifications"] });
			const previous = queryClient.getQueryData<InfiniteData<Notification[]>>(["notifications"]);

			queryClient.setQueryData<InfiniteData<Notification[]>>(["notifications"], (old) => {
				if (!old?.pages) return old;
				return {
					...old,
					pages: old.pages.map((page: Notification[]) => page.map((n) => (n.id === id ? { ...n, isRead: true } : n))),
				};
			});

			return { previous };
		},
		onError: (_err, _id, context: { previous?: InfiniteData<Notification[]> } | undefined) => {
			if (context?.previous) {
				queryClient.setQueryData(["notifications"], context.previous);
			}
		},
		onSuccess: () => {
			console.log("[useNotifications] Notification marked as read successfully");
		},
	});

	// Handle real-time notifications with WebSocket
	useEffect(() => {
		if (!socket) return;

		const handleNew = (notification: Notification) => {
			console.log("[useNotifications] New notification received:", notification);
			queryClient.setQueryData<InfiniteData<Notification[]>>(["notifications"], (old) => {
				if (!old?.pages) return old;

				const firstPage = old.pages[0] || [];

				// check if notification already exists (prevent duplicates)
				const exists = old.pages.some((page: Notification[]) => page.some((n) => n.id === notification.id));

				if (exists) {
					console.log("[useNotifications] Notification already exists, skipping");
					return old;
				}

				// prepend new notification to first page
				console.log("[useNotifications] Adding new notification to cache");
				return {
					...old,
					pages: [[notification, ...firstPage], ...old.pages.slice(1)],
				};
			});
		};

		const handleRead = (updatedNotification: Notification) => {
			console.log("[useNotifications] Notification marked as read:", updatedNotification.id);
			queryClient.setQueryData<InfiniteData<Notification[]>>(["notifications"], (old) => {
				if (!old?.pages) return old;
				return {
					...old,
					pages: old.pages.map((page: Notification[]) =>
						page.map((notif) => (notif.id === updatedNotification.id ? updatedNotification : notif))
					),
				};
			});
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
		isLoading: notificationsQuery.isLoading,
		isError: notificationsQuery.isError,
		isFetchingNextPage: notificationsQuery.isFetchingNextPage,
		hasNextPage: notificationsQuery.hasNextPage,
		fetchNextPage: notificationsQuery.fetchNextPage,
		markAsRead: (id: string) => markReadMutation.mutate(id),
	};
};
