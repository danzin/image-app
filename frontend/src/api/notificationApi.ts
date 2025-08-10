import axiosClient from "./axiosClient";

export const fetchNotifications = async () => {
	const { data } = await axiosClient.get("/api/notifications");
	return data;
};

export const markNotificationAsRead = async (notificationId: string) => {
	const { data } = await axiosClient.post(`/api/notifications/read/${notificationId}`);
	return data;
};
