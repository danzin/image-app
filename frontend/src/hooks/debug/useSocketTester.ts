import { useSocket } from "../context/useSocket";
import { useAuth } from "../context/useAuth";

/**
 * Hook for testing real-time socket connectivity
 * Use this in development to verify socket events are working
 */
export const useSocketTester = () => {
	const socket = useSocket();
	const { user } = useAuth();

	const testLikeUpdate = () => {
		if (!socket) {
			console.warn("Socket not connected");
			return;
		}

		console.log("🧪 Testing like update...");
		socket.emit("test_like_update", {
			type: "like_update",
			imageId: "test-image-123",
			newLikes: 42,
			timestamp: new Date().toISOString(),
		});
	};

	const testNewImage = () => {
		if (!socket) {
			console.warn("Socket not connected");
			return;
		}

		console.log("🧪 Testing new image update...");
		socket.emit("test_feed_update", {
			type: "new_image",
			uploaderId: user?.publicId || "test-user",
			imageId: "test-image-456",
			tags: ["test", "realtime"],
			timestamp: new Date().toISOString(),
		});
	};

	const testAvatarUpdate = () => {
		if (!socket) {
			console.warn("Socket not connected");
			return;
		}

		console.log("🧪 Testing avatar update...");
		socket.emit("test_avatar_update", {
			type: "avatar_changed",
			userId: user?.publicId || "test-user",
			oldAvatar: "/old-avatar.jpg",
			newAvatar: "/new-avatar.jpg",
			timestamp: new Date().toISOString(),
		});
	};

	return {
		isConnected: !!socket?.connected,
		testLikeUpdate,
		testNewImage,
		testAvatarUpdate,
		socket,
	};
};
