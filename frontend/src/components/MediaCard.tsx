import React from "react";
import { IPost } from "../types";
import { Box } from "@mui/material";
import { useNavigate } from "react-router-dom";

interface MediaCardProps {
	post: IPost;
}

const BASE_URL = "/api";

const MediaCard: React.FC<MediaCardProps> = ({ post }) => {
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

	if (!fullImageUrl) return null;

	return (
		<Box
			sx={{
				width: "100%",
				paddingTop: "100%",
				position: "relative",
				cursor: "pointer",
				overflow: "hidden",
				bgcolor: "grey.200",
				"&:hover img": {
					transform: "scale(1.05)",
				},
			}}
			onClick={handleClick}
		>
			<img
				src={fullImageUrl}
				alt={post.body?.substring(0, 50) || "User media"}
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					width: "100%",
					height: "100%",
					objectFit: "cover",
					transition: "transform 0.3s ease",
				}}
			/>
		</Box>
	);
};

export default MediaCard;
