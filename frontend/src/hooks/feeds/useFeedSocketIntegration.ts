import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../context/useSocket";

/**
 * Hook to handle real-time feed updates via WebSocket
 * Integrates socket events with React Query cache invalidation
 */
export const useFeedSocketIntegration = () => {
	const socket = useSocket();
	const queryClient = useQueryClient();

	useEffect(() => {
		if (!socket) return;

		console.log("Setting up feed socket listeners...");

		/**
		 * Handle new post uploads (targeted to specific users)
		 * Backend event: "feed_update" with type: "new_post"
		 */
		const handleNewPost = (data: {
			type: "new_post";
			authorId: string;
			postId: string;
			tags: string[];
			affectedUsers: string[];
			timestamp: string;
		}) => {
			console.log("Real-time: New post received (targeted)", data);

			// Invalidate personalized feeds
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
			queryClient.invalidateQueries({ queryKey: ["forYouFeed"] });
			queryClient.invalidateQueries({ queryKey: ["images"] });

			// Also invalidate author's profile posts
			queryClient.invalidateQueries({ queryKey: ["userImages", data.authorId] });
		};

		/**
		 * Handle like count updates
		 * Backend event: "like_update" with type: "like_count_changed"
		 */
		const handleLikeUpdate = (data: {
			type: "like_count_changed";
			imageId: string;
			newLikes: number;
			timestamp: string;
		}) => {
			console.log("Real-time: Like update received", data);

			// Update image data optimistically in all queries
			const updateImageLikes = (queryKey: unknown[]) => {
				queryClient.setQueriesData({ queryKey }, (oldData: unknown) => {
					if (!oldData) return oldData;

					// Handle infinite query structure
					if (typeof oldData === "object" && oldData !== null && "pages" in oldData) {
						const infiniteData = oldData as { pages: { data: { publicId: string; likes: number }[] }[] };
						return {
							...infiniteData,
							pages: infiniteData.pages.map((page) => ({
								...page,
								data: page.data.map((image) =>
									image.publicId === data.imageId ? { ...image, likes: data.newLikes } : image
								),
							})),
						};
					}

					// Handle regular query structure
					if (typeof oldData === "object" && oldData !== null && "data" in oldData) {
						const regularData = oldData as { data: { publicId: string; likes: number }[] };
						return {
							...regularData,
							data: regularData.data.map((image) =>
								image.publicId === data.imageId ? { ...image, likes: data.newLikes } : image
							),
						};
					}

					// Handle single image
					if (typeof oldData === "object" && oldData !== null && "publicId" in oldData) {
						const imageData = oldData as { publicId: string; likes: number };
						if (imageData.publicId === data.imageId) {
							return { ...imageData, likes: data.newLikes };
						}
					}

					return oldData;
				});
			};

			// Update all feed queries
			updateImageLikes(["personalizedFeed"]);
			updateImageLikes(["forYouFeed"]);
			updateImageLikes(["trendingFeed"]);
			updateImageLikes(["newFeed"]);
			updateImageLikes(["images"]);
			updateImageLikes(["userImages"]);

			// Update specific image queries
			queryClient.invalidateQueries({ queryKey: ["image", data.imageId] });
		};

		/**
		 * Handle avatar updates
		 * Backend event: "avatar_update" with type: "user_avatar_changed"
		 */
		const handleAvatarUpdate = (data: {
			type: "user_avatar_changed";
			userId: string;
			oldAvatar?: string;
			newAvatar?: string;
			timestamp: string;
		}) => {
			console.log("Real-time: Avatar update received", data);

			// Invalidate user data and any feed that shows avatars
			const currentUser = queryClient.getQueryData<{ publicId?: string }>(["currentUser"]);
			if (currentUser?.publicId === data.userId) {
				queryClient.invalidateQueries({ queryKey: ["currentUser"] });
			}
			queryClient.invalidateQueries({ queryKey: ["user", data.userId] });
			queryClient.invalidateQueries({ queryKey: ["user", "publicId", data.userId] });
			queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });
			queryClient.invalidateQueries({ queryKey: ["forYouFeed"] });
			queryClient.invalidateQueries({ queryKey: ["trendingFeed"] });
			queryClient.invalidateQueries({ queryKey: ["newFeed"] });
			queryClient.invalidateQueries({ queryKey: ["images"] });
		};

		/**
		 * Handle general feed interactions
		 * Backend event: "feed_interaction" with type: "user_interaction"
		 */
		const handleFeedInteraction = (data: {
			type: "user_interaction";
			userId: string;
			actionType: string;
			targetId: string;
			tags?: string[];
			timestamp: string;
		}) => {
			console.log("Real-time: Feed interaction received", data);

			// For comments and other interactions that affect counts
			if (data.actionType === "comment" || data.actionType === "comment_deleted") {
				console.log(`Handling ${data.actionType} for image ${data.targetId}`);

				// Invalidate specific image and comment queries for this image
				queryClient.invalidateQueries({ queryKey: ["image"] }); // Refresh image details (comment count)
				queryClient.invalidateQueries({ queryKey: ["comments", "image", data.targetId] }); // Refresh comment list

				// Only invalidate the personalized feed - most relevant for the user
				queryClient.invalidateQueries({ queryKey: ["personalizedFeed"] });

				console.log(`Invalidated image and personalized feed for ${data.actionType} on image ${data.targetId}`);
			}
		};

		// Register all socket event listeners
		socket.on("feed_update", handleNewPost);
		socket.on("like_update", handleLikeUpdate);
		socket.on("avatar_update", handleAvatarUpdate);
		socket.on("feed_interaction", handleFeedInteraction);

		return () => {
			// Cleanup listeners
			socket.off("feed_update", handleNewPost);
			socket.off("like_update", handleLikeUpdate);
			socket.off("avatar_update", handleAvatarUpdate);
			socket.off("feed_interaction", handleFeedInteraction);
			console.log("Feed socket listeners cleaned up");
		};
	}, [socket, queryClient]);
};
