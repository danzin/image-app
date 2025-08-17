import axiosClient from "./axiosClient";
import { Notification } from "../types";
import { mapNotification } from "../lib/mappers";

// Small helper to unwrap axios responses with generics
const unwrap = <T>(promise: Promise<{ data: T }>) => promise.then((r) => r.data);

const errorMessage = (err: unknown): string => {
	if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
		return (err as { message: string }).message;
	}
	return String(err);
};

/**
 * Fetch unread notifications for the current authenticated user.
 * Maps backend shape to strongly typed Notification objects.
 */
export const fetchNotifications = async (signal?: AbortSignal): Promise<Notification[]> => {
	try {
		const raw = await unwrap<unknown[]>(axiosClient.get("/api/notifications", { signal }));
		return raw.map(mapNotification);
	} catch (error) {
		throw new Error(`fetchNotifications failed: ${errorMessage(error)}`);
	}
};

/**
 * Mark a notification as read.
 */
export const markNotificationAsRead = async (notificationId: string, signal?: AbortSignal): Promise<Notification> => {
	if (!notificationId || typeof notificationId !== "string") {
		throw new Error("notificationId is required");
	}
	try {
		console.log(`[useNotificationAPI]: Marking notification ${notificationId} as read`);
		const raw = await unwrap<unknown>(axiosClient.post(`/api/notifications/read/${notificationId}`, { signal }));
		return mapNotification(raw);
	} catch (error) {
		throw new Error(`markNotificationAsRead failed: ${errorMessage(error)}`);
	}
};
