import { useEffect, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from "@tanstack/react-query";
import { fetchNotifications, markNotificationAsRead } from "../../api/notificationApi";
import { Notification } from "../../types";
import { useSocket } from "../context/useSocket";
import { useAuth } from "../context/useAuth";

export const useNotifications = () => {
	const socket = useSocket();
	const queryClient = useQueryClient();
	const { user } = useAuth();
	const isVerified = user ? !("isEmailVerified" in user) || user.isEmailVerified !== false : false;

	// use infinite query for cursor-based pagination
	const notificationsQuery = useInfiniteQuery<Notification[]>({
		queryKey: ["notifications"],
		queryFn: ({ signal, pageParam }) => {
			// pageParam is the timestamp cursor for pagination
			return fetchNotifications(signal, pageParam as string | undefined);
		},
		enabled: isVerified,
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
		refetchOnMount: false, // dont refetch on component mount if data exists
	});

	// flatten all pages into single array
	const notifications = useMemo(() => {
		if (!notificationsQuery.data) return [];
		return notificationsQuery.data.pages.flat();
	}, [notificationsQuery.data]);

	const markReadMutation = useMutation({
		mutationFn: (id: string) => markNotificationAsRead(id),
		// Make use of optimistic update
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

	// This handles real-time notifications with WebSocket
	useEffect(() => {
		if (!socket || !isVerified) return;

		const handleNew = (notification: Notification) => {
			console.log("[useNotifications] New notification received:", notification);
			queryClient.setQueryData<InfiniteData<Notification[]>>(["notifications"], (oldData) => {
				if (!oldData) {
					return {
						pages: [[notification]],
						pageParams: [undefined],
					};
				}

				const exists = oldData.pages.some((page) => page.some((n) => n.id === notification.id));
				if (exists) {
					console.log("[useNotifications] Notification already exists, skipping");
					return oldData;
				}
				const newPages = [...oldData.pages];
				// Prepend the new notification to the very first page
				newPages[0] = [notification, ...newPages[0]];

				return {
					...oldData,
					pages: newPages,
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
						page.map((notif) => (notif.id === updatedNotification.id ? updatedNotification : notif)),
					),
				};
			});
		};

		socket.on("new_notification", handleNew);

		socket.on("notification_read", handleRead);

		return () => {
			socket.off("new_notification", handleNew);
			socket.off("notification_read", handleRead);
		};
	}, [socket, queryClient, isVerified]);

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
