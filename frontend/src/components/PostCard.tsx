import React, { useState } from "react";
import { IPost } from "../types";
import { Typography, Box, Avatar } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { useNavigate } from "react-router-dom";
import HashtagText from "./HashtagText";

interface PostCardProps {
	post: IPost;
}

const BASE_URL = "/api";

// Format large numbers 2345 -> 2.3K
const formatCount = (count: number | undefined): string => {
	if (count === undefined || count === null) {
		return "0";
	}
	if (count >= 1000000) {
		return `${(count / 1000000).toFixed(1)}M`;
	}
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1)}K`;
	}
	return count.toString();
};

const PostCard: React.FC<PostCardProps> = ({ post }) => {
	const navigate = useNavigate();
	const [isExpanded, setIsExpanded] = useState(false);

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
		<Box
			sx={{
				width: "100%",
				borderBottom: "1px solid",
				borderColor: "divider",
				cursor: "pointer",
				transition: "background-color 0.2s",
				"&:hover": {
					bgcolor: "rgba(255, 255, 255, 0.03)",
				},
			}}
			onClick={handleClick}
		>
			{/* User Info Header */}
			<Box
				sx={{
					px: 2,
					pt: 1.5,
					pb: 1,
					display: "flex",
					alignItems: "flex-start",
					gap: 1.5,
				}}
			>
				<Avatar
					sx={{
						width: 40,
						height: 40,
						cursor: "pointer",
					}}
					onClick={(e) => {
						e.stopPropagation();
						navigate(`/profile/${post.user?.publicId}`);
					}}
				>
					{post.user?.avatar ? (
						<img
							src={`/api/${post.user.avatar}`}
							alt={post.user.username}
							style={{ width: "100%", height: "100%", objectFit: "cover" }}
						/>
					) : (
						<span>{post.user?.username?.charAt(0).toUpperCase()}</span>
					)}
				</Avatar>

				<Box sx={{ flex: 1, minWidth: 0 }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
						<Typography
							variant="body1"
							sx={{
								fontWeight: 700,
								color: "text.primary",
								"&:hover": { textDecoration: "underline" },
							}}
							onClick={(e) => {
								e.stopPropagation();
								navigate(`/profile/${post.user?.publicId}`);
							}}
						>
							{post.user?.username || "Unknown"}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							{new Date(post.createdAt).toLocaleDateString(undefined, {
								month: "short",
								day: "numeric",
							})}
						</Typography>
					</Box>

					{/* Post Content */}
					{post.body && (
						<Typography
							variant="body1"
							sx={{
								color: "text.primary",
								lineHeight: 1.5,
								whiteSpace: "pre-wrap",
								wordBreak: "break-word",
								mb: hasImage ? 1.5 : 0,
							}}
						>
							<HashtagText
								text={isExpanded || !post.body || post.body.length <= 280 ? post.body : post.body.slice(0, 280) + "..."}
							/>
							{post.body && post.body.length > 280 && !isExpanded && (
								<Box
									component="span"
									sx={{
										color: "primary.main",
										cursor: "pointer",
										ml: 0.5,
										fontWeight: 500,
										"&:hover": { textDecoration: "underline" },
									}}
									onClick={(e) => {
										e.stopPropagation();
										setIsExpanded(true);
									}}
								>
									Show more
								</Box>
							)}
						</Typography>
					)}

					{/* Image Display */}
					{hasImage && (
						<Box
							sx={{
								mt: 1.5,
								borderRadius: 3,
								overflow: "hidden",
								border: "1px solid",
								borderColor: "divider",
								width: "100%",
								maxHeight: "600px",
								display: "flex",
								justifyContent: "center",
								bgcolor: "black",
							}}
						>
							<img
								src={fullImageUrl}
								alt={post.body?.substring(0, 50) || post.publicId}
								style={{
									width: "100%",
									height: "auto",
									maxHeight: "600px",
									objectFit: "cover",
									display: "block",
								}}
							/>
						</Box>
					)}

					{/* Card Actions - Stats */}
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							maxWidth: 425,
							mt: 1.5,
						}}
					>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 0.5,
								color: "text.secondary",
								"&:hover": { color: "#ec4899" },
							}}
						>
							<FavoriteIcon fontSize="small" sx={{ fontSize: 18 }} />
							<Typography variant="caption">{formatCount(post.likes || 0)}</Typography>
						</Box>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 0.5,
								color: "text.secondary",
								"&:hover": { color: "#3b82f6" },
							}}
						>
							<CommentIcon fontSize="small" sx={{ fontSize: 18 }} />
							<Typography variant="caption">{formatCount(post.commentsCount || 0)}</Typography>
						</Box>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 0.5,
								color: "text.secondary",
								"&:hover": { color: "#8b5cf6" },
							}}
						>
							<VisibilityIcon fontSize="small" sx={{ fontSize: 18 }} />
							<Typography variant="caption">{formatCount(post.viewsCount || 0)}</Typography>
						</Box>
					</Box>
				</Box>
			</Box>
		</Box>
	);
};

export default PostCard;
