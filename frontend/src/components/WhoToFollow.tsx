import React from "react";
import { Box, Typography, Avatar, Button, Card, Skeleton, useTheme } from "@mui/material";
import { Link } from "react-router-dom";
import { useWhoToFollow } from "../hooks/user/useWhoToFollow";
import { useFollowUser } from "../hooks/user/useUserAction";
import { useQueryClient } from "@tanstack/react-query";
import { SuggestedUser } from "@/types";

interface WhoToFollowProps {
	limit?: number;
}

const WhoToFollow: React.FC<WhoToFollowProps> = ({ limit = 5 }) => {
	const theme = useTheme();
	const queryClient = useQueryClient();
	const { data, isLoading, isError } = useWhoToFollow(limit);
	const followMutation = useFollowUser();

	if (isError) {
		return null;
	}

	if (isLoading) {
		return (
			<Card
				sx={{
					bgcolor: "background.paper",
					borderRadius: 2,
					p: 3,
					boxShadow: theme.shadows[2],
				}}
			>
				<Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
					Who to Follow
				</Typography>
				{Array.from({ length: 3 }).map((_, index) => (
					<Box key={index} sx={{ display: "flex", alignItems: "center", mb: 2 }}>
						<Skeleton variant="circular" width={48} height={48} />
						<Box sx={{ ml: 2, flex: 1 }}>
							<Skeleton variant="text" width="60%" height={24} />
							<Skeleton variant="text" width="40%" height={20} />
						</Box>
						<Skeleton variant="rectangular" width={80} height={32} sx={{ borderRadius: 2 }} />
					</Box>
				))}
			</Card>
		);
	}

	if (!data?.suggestions || data.suggestions.length === 0) {
		return null;
	}

	const handleFollow = async (publicId: string) => {
		try {
			await followMutation.mutateAsync(publicId);
			queryClient.invalidateQueries({ queryKey: ["whoToFollow"] });
		} catch (error) {
			console.error("Failed to follow user:", error);
		}
	};

	return (
		<Card
			sx={{
				bgcolor: "background.paper",
				borderRadius: 2,
				p: 3,
				boxShadow: theme.shadows[2],
			}}
		>
			<Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: "text.primary" }}>
				Who to Follow
			</Typography>

			{data.suggestions.map((user: SuggestedUser) => (
				<Box
					key={user.publicId}
					sx={{
						display: "flex",
						alignItems: "center",
						mb: 2,
						"&:last-child": { mb: 0 },
					}}
				>
					<Avatar
						component={Link}
						to={`/profile/${user.username}`}
						src={user.avatar}
						alt={user.username}
						sx={{
							width: 48,
							height: 48,
							cursor: "pointer",
							transition: "transform 0.2s",
							"&:hover": {
								transform: "scale(1.05)",
							},
						}}
					/>

					<Box sx={{ ml: 2, flex: 1, minWidth: 0 }}>
						<Typography
							component={Link}
							to={`/profile/${user.username}`}
							variant="body1"
							sx={{
								fontWeight: 600,
								color: "text.primary",
								textDecoration: "none",
								display: "block",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								"&:hover": {
									textDecoration: "underline",
								},
							}}
						>
							{user.username}
						</Typography>
						<Typography
							variant="body2"
							sx={{
								color: "text.secondary",
								fontSize: "0.875rem",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							@{user.username}
						</Typography>
					</Box>

					<Button
						onClick={() => handleFollow(user.publicId)}
						disabled={followMutation.isPending}
						variant="contained"
						size="small"
						sx={{
							textTransform: "none",
							fontWeight: 600,
							borderRadius: 2,
							px: 2,
							bgcolor: "primary.main",
							color: "primary.contrastText",
							"&:hover": {
								bgcolor: "primary.dark",
							},
							"&:disabled": {
								opacity: 0.6,
							},
						}}
					>
						{followMutation.isPending ? "Following..." : "Follow"}
					</Button>
				</Box>
			))}
		</Card>
	);
};

export default WhoToFollow;
