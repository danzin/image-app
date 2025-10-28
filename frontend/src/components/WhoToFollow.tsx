import React, { useState, useEffect } from "react";
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

	// track follow state for each user (publicId -> isFollowing)
	const [followStates, setFollowStates] = useState<Record<string, boolean>>({});

	// initialize follow states when data loads
	useEffect(() => {
		if (data?.suggestions) {
			const initialStates: Record<string, boolean> = {};
			data.suggestions.forEach((user) => {
				// users in suggestions are not followed yet
				initialStates[user.publicId] = false;
			});
			setFollowStates(initialStates);
		}
	}, [data?.suggestions]);

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
		const currentlyFollowing = followStates[publicId] || false;

		try {
			// optimistically toggle the follow state
			setFollowStates((prev) => ({
				...prev,
				[publicId]: !currentlyFollowing,
			}));

			await followMutation.mutateAsync(publicId);

			// invalidate to ensure data is fresh
			queryClient.invalidateQueries({
				queryKey: ["isFollowing", publicId],
			});
			queryClient.invalidateQueries({
				queryKey: ["whoToFollow", limit],
				refetchType: "active",
			});
		} catch (error) {
			console.error("Failed to follow user:", error);
			// revert the optimistic update on err
			setFollowStates((prev) => ({
				...prev,
				[publicId]: currentlyFollowing,
			}));
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
						variant={followStates[user.publicId] ? "outlined" : "contained"}
						size="small"
						sx={{
							textTransform: "none",
							fontWeight: 600,
							borderRadius: 2,
							px: 2,
							minWidth: 90,
							bgcolor: followStates[user.publicId] ? "transparent" : "primary.main",
							color: followStates[user.publicId] ? "primary.main" : "primary.contrastText",
							borderColor: followStates[user.publicId] ? "primary.main" : "transparent",
							"&:hover": {
								bgcolor: followStates[user.publicId] ? "action.hover" : "primary.dark",
								borderColor: "primary.main",
							},
							"&:disabled": {
								opacity: 0.6,
							},
						}}
					>
						{followMutation.isPending ? "..." : followStates[user.publicId] ? "Unfollow" : "Follow"}
					</Button>
				</Box>
			))}
		</Card>
	);
};

export default WhoToFollow;
