import React, { useEffect, useRef } from "react";
import {
	Box,
	Typography,
	List,
	ListItem,
	ListItemAvatar,
	ListItemText,
	Avatar,
	CircularProgress,
	alpha,
	useTheme,
	Chip,
	IconButton,
	Button,
} from "@mui/material";
import {
	Favorite as FavoriteIcon,
	Comment as CommentIcon,
	PersonAdd as PersonAddIcon,
	CheckCircle as CheckCircleIcon,
	ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import { useNotifications } from "../hooks/notifications/useNotification";
import { Notification } from "../types";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const BASE_URL = "/api";

const Notifications: React.FC = () => {
	const theme = useTheme();
	const navigate = useNavigate();
	const { notifications, isLoading, markAsRead, hasNextPage, fetchNextPage, isFetchingNextPage } = useNotifications();

	const observerTarget = useRef<HTMLDivElement>(null);

	// infinite scroll with intersection observer
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					console.log("[Notifications] Loading more notifications...");
					fetchNextPage();
				}
			},
			{ threshold: 0.1 }
		);

		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}

		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	const getActionIcon = (actionType: string) => {
		switch (actionType) {
			case "like":
				return <FavoriteIcon sx={{ color: "#ec4899", fontSize: 20 }} />;
			case "comment":
				return <CommentIcon sx={{ color: "#3b82f6", fontSize: 20 }} />;
			case "follow":
				return <PersonAddIcon sx={{ color: "#10b981", fontSize: 20 }} />;
			default:
				return null;
		}
	};

	const getActionText = (notification: Notification) => {
		switch (notification.actionType) {
			case "like":
				return "liked your post";
			case "comment":
				return "commented on your post";
			case "follow":
				return "started following you";
			default:
				return notification.actionType;
		}
	};

	const handleNotificationClick = (notification: Notification) => {
		// mark as read
		if (!notification.isRead) {
			markAsRead(notification.id);
		}

		// navigate to target
		if (notification.targetId && notification.targetType === "post") {
			navigate(`/posts/${notification.targetId}`);
		} else if (notification.targetId && notification.targetType === "image") {
			navigate(`/images/${notification.targetId}`);
		} else if (notification.actionType === "follow") {
			navigate(`/profile/${notification.actorId}`);
		}
	};

	const getAvatarUrl = (avatar?: string) => {
		if (!avatar) return undefined;
		if (avatar.startsWith("http")) return avatar;
		if (avatar.startsWith("/")) return `${BASE_URL}${avatar}`;
		return `${BASE_URL}/${avatar}`;
	};

	if (isLoading) {
		return (
			<Box
				sx={{
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
					minHeight: "60vh",
				}}
			>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box
			sx={{
				maxWidth: 700,
				mx: "auto",
				p: 3,
			}}
		>
			<Typography
				variant="h4"
				sx={{
					mb: 3,
					fontWeight: 700,
					background: "linear-gradient(45deg, #6366f1, #ec4899)",
					backgroundClip: "text",
					WebkitBackgroundClip: "text",
					color: "transparent",
				}}
			>
				Notifications
			</Typography>

			{notifications.length === 0 ? (
				<Box
					sx={{
						textAlign: "center",
						py: 8,
						px: 3,
						borderRadius: 3,
						background: "linear-gradient(145deg, rgba(26, 26, 46, 0.6) 0%, rgba(22, 33, 62, 0.6) 100%)",
						border: "1px solid rgba(99, 102, 241, 0.2)",
					}}
				>
					<Typography variant="h6" color="text.secondary">
						No notifications yet
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
						When someone interacts with your posts, you'll see it here
					</Typography>
				</Box>
			) : (
				<List sx={{ p: 0 }}>
					{notifications.map((notification) => {
						const avatarUrl = getAvatarUrl(notification.actorAvatar);

						return (
							<ListItem
								key={notification.id}
								onClick={() => handleNotificationClick(notification)}
								sx={{
									mb: 1,
									borderRadius: 3,
									background: notification.isRead
										? "linear-gradient(145deg, rgba(26, 26, 46, 0.4) 0%, rgba(22, 33, 62, 0.4) 100%)"
										: "linear-gradient(145deg, rgba(99, 102, 241, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%)",
									border: notification.isRead
										? "1px solid rgba(99, 102, 241, 0.1)"
										: "1px solid rgba(99, 102, 241, 0.3)",
									cursor: "pointer",
									transition: "all 0.3s ease",
									position: "relative",
									"&:hover": {
										transform: "translateX(4px)",
										borderColor: theme.palette.primary.main,
										background: "linear-gradient(145deg, rgba(99, 102, 241, 0.2) 0%, rgba(236, 72, 153, 0.15) 100%)",
									},
								}}
							>
								{/* Unread indicator */}
								{!notification.isRead && (
									<Box
										sx={{
											position: "absolute",
											left: 8,
											top: "50%",
											transform: "translateY(-50%)",
											width: 8,
											height: 8,
											borderRadius: "50%",
											bgcolor: "#ec4899",
											boxShadow: "0 0 8px rgba(236, 72, 153, 0.6)",
										}}
									/>
								)}

								<ListItemAvatar sx={{ ml: notification.isRead ? 0 : 2 }}>
									<Avatar
										src={avatarUrl}
										sx={{
											border: "2px solid rgba(99, 102, 241, 0.3)",
											background: "linear-gradient(45deg, #6366f1, #8b5cf6)",
										}}
									>
										{notification.actorUsername?.charAt(0).toUpperCase()}
									</Avatar>
								</ListItemAvatar>

								<ListItemText
									primary={
										<Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
											<Typography
												component="span"
												variant="body1"
												sx={{
													fontWeight: 600,
													color: theme.palette.primary.light,
												}}
											>
												{notification.actorUsername || "Someone"}
											</Typography>
											<Typography component="span" variant="body2" color="text.secondary">
												{getActionText(notification)}
											</Typography>
											{!notification.isRead && (
												<Chip
													label="New"
													size="small"
													sx={{
														height: 20,
														fontSize: "0.7rem",
														background: "linear-gradient(45deg, #ec4899, #f472b6)",
														color: "white",
														fontWeight: 600,
													}}
												/>
											)}
										</Box>
									}
									secondary={
										<Box sx={{ mt: 0.5 }}>
											{notification.targetPreview && (
												<Typography
													variant="body2"
													sx={{
														color: alpha(theme.palette.text.primary, 0.7),
														mb: 0.5,
														fontStyle: "italic",
													}}
												>
													"{notification.targetPreview}"
												</Typography>
											)}
											<Typography variant="caption" color="text.secondary">
												{formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
											</Typography>
										</Box>
									}
								/>

								<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
									{getActionIcon(notification.actionType)}
									{notification.isRead && (
										<IconButton size="small" sx={{ color: "success.main" }}>
											<CheckCircleIcon fontSize="small" />
										</IconButton>
									)}
								</Box>
							</ListItem>
						);
					})}

					{/* Infinite scroll trigger */}
					<div ref={observerTarget} style={{ height: 20 }} />

					{/* Loading indicator for next page */}
					{isFetchingNextPage && (
						<Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
							<CircularProgress size={24} />
						</Box>
					)}

					{/* Manual load more button (fallback) */}
					{hasNextPage && !isFetchingNextPage && (
						<Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
							<Button
								onClick={() => fetchNextPage()}
								startIcon={<ExpandMoreIcon />}
								sx={{
									background: "linear-gradient(45deg, rgba(99, 102, 241, 0.2), rgba(236, 72, 153, 0.2))",
									border: "1px solid rgba(99, 102, 241, 0.3)",
									borderRadius: 3,
									px: 3,
									"&:hover": {
										background: "linear-gradient(45deg, rgba(99, 102, 241, 0.3), rgba(236, 72, 153, 0.3))",
									},
								}}
							>
								Load More
							</Button>
						</Box>
					)}

					{/* End of list indicator */}
					{!hasNextPage && notifications.length > 0 && (
						<Typography
							variant="caption"
							color="text.secondary"
							sx={{
								display: "block",
								textAlign: "center",
								py: 2,
							}}
						>
							You've reached the end of your notifications
						</Typography>
					)}
				</List>
			)}
		</Box>
	);
};

export default Notifications;
