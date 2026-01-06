import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Box, Typography, Button, Container, CircularProgress, Paper, Avatar } from "@mui/material";
import { useCommunity, useJoinCommunity, useLeaveCommunity } from "../hooks/communities/useCommunity";
import { useCommunityPosts } from "../hooks/communities/useCommunityPosts";
import Gallery from "../components/Gallery";
import CreatePost from "../components/CreatePost";
import { useAuth } from "../hooks/context/useAuth";

const CommunityDetails: React.FC = () => {
	const { slug } = useParams<{ slug: string }>();
	const navigate = useNavigate();
	const { data: community, isLoading: isCommunityLoading } = useCommunity(slug);
	const { isLoggedIn } = useAuth();

	const {
		data: postsData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: isPostsLoading,
	} = useCommunityPosts(community?.publicId);

	const { mutate: joinCommunity, isPending: isJoining } = useJoinCommunity();
	const { mutate: leaveCommunity, isPending: isLeaving } = useLeaveCommunity();

	const activePosts = useMemo(() => postsData?.pages.flatMap((p) => p.data) ?? [], [postsData]);

	if (isCommunityLoading) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!community) {
		return (
			<Container maxWidth="md" sx={{ py: 4 }}>
				<Typography variant="h5" align="center">
					Community not found
				</Typography>
			</Container>
		);
	}

	const handleJoinLeave = () => {
		if (community.isMember) {
			leaveCommunity(community.publicId);
		} else {
			joinCommunity(community.publicId);
		}
	};

	return (
		<Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
			{/* Banner */}
			<Box
				sx={{
					height: 200,
					bgcolor: "grey.800",
					background: "linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)", // Default gradient
					backgroundSize: "cover",
					backgroundPosition: "center",
				}}
			/>

			<Container maxWidth="md" sx={{ mt: -5 }}>
				<Paper sx={{ p: 3, mb: 4, position: "relative", borderRadius: 2, backgroundColor: "transparent" }}>
					<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
						<Box sx={{ mt: -8 }}>
							<Avatar
								src={community.avatar || undefined}
								sx={{
									width: 120,
									height: 120,
									border: "4px solid",
									borderColor: "background.paper",
									bgcolor: "primary.main",
									fontSize: "3rem",
								}}
							>
								{community.name.charAt(0).toUpperCase()}
							</Avatar>
						</Box>
						<Box sx={{ mt: 2 }}>
							{isLoggedIn && (
								<Button
									variant={community.isMember ? "outlined" : "contained"}
									onClick={handleJoinLeave}
									disabled={isJoining || isLeaving}
									sx={{ borderRadius: 20, textTransform: "none", fontWeight: "bold" }}
								>
									{community.isMember ? "Leave" : "Join"}
								</Button>
							)}
						</Box>
					</Box>

					<Box sx={{ mt: 2 }}>
						<Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
							{community.name}
						</Typography>
						<Typography variant="body1" color="text.secondary" paragraph>
							{community.description}
						</Typography>
						<Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
							<Box
								sx={{
									display: "flex",
									gap: 0.5,
									cursor: "pointer",
									"&:hover": { textDecoration: "underline" },
								}}
								onClick={() => navigate(`/communities/${slug}/members`)}
							>
								<Typography variant="body2" fontWeight="bold" color="text.primary">
									{community.stats.memberCount}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									members
								</Typography>
							</Box>
							<Box sx={{ display: "flex", gap: 0.5 }}>
								<Typography variant="body2" fontWeight="bold" color="text.primary">
									{community.stats.postCount}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									posts
								</Typography>
							</Box>
						</Box>
					</Box>
				</Paper>

				{/* Post creation prompt for community members */}
				{isLoggedIn && community.isMember && (
					<Paper sx={{ mb: 4, p: 2, borderRadius: 2, backgroundColor: "transparent" }}>
						<CreatePost defaultCommunityPublicId={community.publicId} />
					</Paper>
				)}

				<Box>
					<Typography variant="h5" sx={{ mb: 2, fontWeight: "bold" }}>
						Posts
					</Typography>
					<Gallery
						posts={activePosts}
						fetchNextPage={fetchNextPage}
						hasNextPage={hasNextPage}
						isFetchingNext={isFetchingNextPage}
						isLoadingAll={isPostsLoading}
						emptyTitle="No posts yet"
						emptyDescription="Be the first to post in this community!"
					/>
				</Box>
			</Container>
		</Box>
	);
};

export default CommunityDetails;
