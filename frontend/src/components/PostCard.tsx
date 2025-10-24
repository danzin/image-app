import React from "react";
import { IPost } from "../types";
import { Card, CardActions, Typography, Chip, Box, Avatar, IconButton } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate } from "react-router-dom";
import HashtagText from "./HashtagText";

interface PostCardProps {
	post: IPost;
}

const BASE_URL = "/api";

const PostCard: React.FC<PostCardProps> = ({ post }) => {
	const navigate = useNavigate();

	const handleClick = () => {
		navigate(`/posts/${post.publicId}`);
	};

	// Handle optional image URL
	const fullImageUrl = post.url
		? post.url.startsWith("http")
			? post.url
			: post.url.startsWith("/")
				? `${BASE_URL}${post.url}`
				: `${BASE_URL}/${post.url}`
		: post.image?.url
			? post.image.url.startsWith("http")
				? post.image.url
				: post.image.url.startsWith("/")
					? `${BASE_URL}${post.image.url}`
					: `${BASE_URL}/${post.image.url}`
			: undefined;

	const hasImage = !!fullImageUrl;

	return (
		<Card
			sx={{
				width: "100%",
				maxWidth: "700px",
				overflow: "hidden",
				background: "linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)",
				border: "1px solid rgba(99, 102, 241, 0.2)",
				borderRadius: 3,
				cursor: "pointer",
				transition: "all 0.3s ease",
				"&:hover": {
					transform: "translateY(-4px)",
					borderColor: "rgba(99, 102, 241, 0.4)",
					boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
				},
			}}
			onClick={handleClick}
		>
			{/* User Info Header */}
			<Box
				sx={{
					px: 3,
					pt: 2.5,
					pb: 1.5,
					display: "flex",
					alignItems: "center",
					gap: 1.5,
				}}
			>
				<Avatar
					sx={{
						width: 40,
						height: 40,
						border: "2px solid rgba(99, 102, 241, 0.3)",
						background: "linear-gradient(45deg, #6366f1, #8b5cf6)",
					}}
				>
					{post.user?.avatar ? (
						<img
							src={`/api/${post.user.avatar}`}
							alt={post.user.username}
							style={{ width: "100%", height: "100%", borderRadius: "50%" }}
						/>
					) : (
						<span>{post.user?.username?.charAt(0).toUpperCase()}</span>
					)}
				</Avatar>
				<Box sx={{ flex: 1 }}>
					<Typography variant="body1" sx={{ fontWeight: 600, color: "text.primary" }}>
						{post.user?.username || "Unknown"}
					</Typography>
					<Typography variant="caption" color="text.secondary">
						{new Date(post.createdAt).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
							year: "numeric",
						})}
					</Typography>
				</Box>
			</Box>
			{/* Post Content */}
			{post.body && (
				<Box sx={{ px: 3, pb: hasImage ? 2 : 1 }}>
					<Typography
						variant="body1"
						sx={{
							color: "text.primary",
							lineHeight: 1.6,
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
						}}
					>
						<HashtagText text={post.body} />
					</Typography>
				</Box>
			)}{" "}
			{/* Image Display */}
			{hasImage && (
				<Box sx={{ position: "relative", overflow: "hidden" }}>
					<img
						src={fullImageUrl}
						alt={post.body?.substring(0, 50) || post.publicId}
						style={{
							width: "100%",
							maxHeight: "500px",
							objectFit: "cover",
							display: "block",
						}}
					/>
					{/* Gradient overlay for better readability */}
					<Box
						sx={{
							position: "absolute",
							bottom: 0,
							left: 0,
							right: 0,
							height: "60px",
							background: "linear-gradient(transparent, rgba(0, 0, 0, 0.6))",
							pointerEvents: "none",
						}}
					/>
				</Box>
			)}
			{/* Card Actions - Stats */}
			<CardActions
				disableSpacing
				sx={{
					justifyContent: "space-between",
					px: 3,
					py: 2,
					background: "rgba(26, 26, 46, 0.9)",
					backdropFilter: "blur(10px)",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<Chip
						icon={<FavoriteIcon fontSize="small" />}
						label={post.likes}
						size="small"
						sx={{
							background: "linear-gradient(45deg, rgba(236, 72, 153, 0.2), rgba(99, 102, 241, 0.2))",
							border: "1px solid rgba(236, 72, 153, 0.3)",
							color: "#ec4899",
							"& .MuiChip-icon": { color: "#ec4899" },
						}}
					/>
					<Chip
						icon={<CommentIcon fontSize="small" />}
						label={post.commentsCount || 0}
						size="small"
						sx={{
							background: "linear-gradient(45deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2))",
							border: "1px solid rgba(59, 130, 246, 0.3)",
							color: "#3b82f6",
							"& .MuiChip-icon": { color: "#3b82f6" },
						}}
					/>
				</Box>
				<IconButton
					size="small"
					sx={{
						color: "primary.light",
						"&:hover": {
							color: "primary.main",
							transform: "scale(1.1)",
						},
					}}
				>
					<VisibilityIcon fontSize="small" />
				</IconButton>
			</CardActions>
		</Card>
	);
};

export default PostCard;
