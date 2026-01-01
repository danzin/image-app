import React, { useState } from "react";
import { IPost } from "../types";
import { Typography, Box, Avatar } from "@mui/material";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CommentIcon from "@mui/icons-material/Comment";
import VisibilityIcon from "@mui/icons-material/Visibility";
import RepeatIcon from "@mui/icons-material/Repeat";
import GroupsIcon from "@mui/icons-material/Groups";
import { useNavigate } from "react-router-dom";
import RichText from "./RichText";
import { useRepostPost } from "../hooks/posts/usePosts";
import { useAuth } from "../hooks/context/useAuth";
import { useTranslation } from "react-i18next";

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
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { isLoggedIn } = useAuth();
	const { mutate: triggerRepost } = useRepostPost();
	const [isExpanded, setIsExpanded] = useState(false);

	const handleClick = () => {
		navigate(`/posts/${post.publicId}`);
	};

	const handleRepostClick = (event: React.MouseEvent) => {
		event.stopPropagation();
		if (!isLoggedIn) {
			navigate("/login");
			return;
		}

		triggerRepost({ postPublicId: post.publicId });
	};

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
			{/* Community Badge - shown when post is from a community */}
			{post.community && (
				<Box
					sx={{
						px: 2,
						pt: 1.5,
						pb: 0.5,
						display: "flex",
						alignItems: "center",
						gap: 0.75,
					}}
					onClick={(e) => {
						e.stopPropagation();
						navigate(`/communities/${post.community!.slug}`);
					}}
				>
					{post.community.avatar ? (
						<Avatar
							src={post.community.avatar.startsWith("http") ? post.community.avatar : `/api/${post.community.avatar}`}
							sx={{ width: 16, height: 16 }}
						/>
					) : (
						<GroupsIcon sx={{ fontSize: 16, color: "primary.main" }} />
					)}
					<Typography
						variant="caption"
						sx={{
							color: "primary.main",
							fontWeight: 600,
							cursor: "pointer",
							"&:hover": { textDecoration: "underline" },
						}}
					>
						{post.community.name}
					</Typography>
				</Box>
			)}

			{/* User Info Header */}
			<Box
				sx={{
					px: 2,
					pt: post.community ? 0.5 : 1.5,
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
							src={post.user.avatar.startsWith("http") ? post.user.avatar : `/api/${post.user.avatar}`}
							alt={post.user.username}
							style={{ width: "100%", height: "100%", objectFit: "cover" }}
						/>
					) : (
						<span>{post.user?.username?.charAt(0).toUpperCase()}</span>
					)}
				</Avatar>

				<Box sx={{ flex: 1, minWidth: 0 }}>
					{post.type === "repost" && post.repostOf?.user && (
						<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.25 }}>
							{t("post.reposted_from", { username: post.repostOf.user.username })}
						</Typography>
					)}
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
							{post.user?.username || t("post.unknown_user")}
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
							<RichText
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
									{t("post.show_more")}
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

					{/* Reposted Content */}
					{post.type === "repost" && post.repostOf && (
						<Box
							sx={{
								mt: 1.5,
								border: "1px solid",
								borderColor: "divider",
								borderRadius: 3,
								p: 1.5,
								cursor: "pointer",
								"&:hover": {
									bgcolor: "rgba(255, 255, 255, 0.03)",
								},
							}}
							onClick={(e) => {
								e.stopPropagation();
								navigate(`/posts/${post.repostOf!.publicId}`);
							}}
						>
							<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
								<Avatar
									sx={{ width: 24, height: 24 }}
									src={post.repostOf.user.avatar ? `/api/${post.repostOf.user.avatar}` : undefined}
								>
									{post.repostOf.user.username.charAt(0).toUpperCase()}
								</Avatar>
								<Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
									{post.repostOf.user.username}
								</Typography>
							</Box>

							{post.repostOf.body && (
								<Typography variant="body2" sx={{ mb: post.repostOf.image ? 1.5 : 0 }}>
									<RichText text={post.repostOf.body} />
								</Typography>
							)}

							{post.repostOf.image && (
								<Box
									sx={{
										borderRadius: 2,
										overflow: "hidden",
										width: "100%",
										maxHeight: "400px",
										display: "flex",
										justifyContent: "center",
										bgcolor: "black",
									}}
								>
									<img
										src={
											post.repostOf.image.url.startsWith("http")
												? post.repostOf.image.url
												: post.repostOf.image.url.startsWith("/")
													? `${BASE_URL}${post.repostOf.image.url}`
													: `${BASE_URL}/${post.repostOf.image.url}`
										}
										alt={t("post.reposted_content")}
										style={{
											width: "100%",
											height: "auto",
											maxHeight: "400px",
											objectFit: "cover",
											display: "block",
										}}
									/>
								</Box>
							)}

							{/* Original Post Stats */}
							<Box sx={{ display: "flex", gap: 2, mt: 1, color: "text.secondary" }}>
								<Typography variant="caption">
									{formatCount(post.repostOf.likes || 0)} {t("post.likes")}
								</Typography>
								<Typography variant="caption">
									{formatCount(post.repostOf.repostCount || 0)} {t("post.reposts")}
								</Typography>
								<Typography variant="caption">
									{formatCount(post.repostOf.commentsCount || 0)} {t("post.comments")}
								</Typography>
							</Box>
						</Box>
					)}

					{/* Card Actions - Stats */}
					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							maxWidth: 520,
							mt: 1.5,
						}}
					>
						<Box
							sx={{
								display: "flex",
								alignItems: "center",
								gap: 0.5,
								color: "text.secondary",
								"&:hover": { color: "#8b5cf6" },
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
								"&:hover": { color: "#22c55e" },
								cursor: "pointer",
							}}
							onClick={handleRepostClick}
						>
							<RepeatIcon fontSize="small" sx={{ fontSize: 18 }} />
							<Typography variant="caption">{formatCount(post.repostCount || 0)}</Typography>
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
