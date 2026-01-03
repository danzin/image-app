import React, { useMemo } from "react";
import { useParams } from "react-router-dom";
import { Box, Typography, Button, Container, CircularProgress, Paper, Avatar } from "@mui/material";
import { useCommunity, useJoinCommunity, useLeaveCommunity } from "../hooks/communities/useCommunity";
import { useCommunityPosts } from "../hooks/communities/useCommunityPosts";
import Gallery from "../components/Gallery";
import CreatePost from "../components/CreatePost";
import { useAuth } from "../hooks/context/useAuth";

const CommunityDetails: React.FC = () => {
	const { slug } = useParams<{ slug: string }>();
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
		<Container maxWidth="md" sx={{ py: 4 }}>
			<Paper sx={{ p: 3, mb: 4 }}>
				<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
						<Avatar src={community.avatar || undefined} sx={{ width: 64, height: 64 }}>
							{community.name.charAt(0).toUpperCase()}
						</Avatar>
						<Box>
							<Typography variant="h4" component="h1" gutterBottom>
								{community.name}
							</Typography>
							<Typography variant="body1" color="text.secondary" paragraph>
								{community.description}
							</Typography>
							<Typography variant="caption" display="block">
								{community.stats.memberCount} members • {community.stats.postCount} posts
							</Typography>
						</Box>
					</Box>
					{isLoggedIn && (
						<Button
							variant={community.isMember ? "outlined" : "contained"}
							onClick={handleJoinLeave}
							disabled={isJoining || isLeaving}
						>
							{community.isMember ? "Leave" : "Join"}
						</Button>
					)}
				</Box>
			</Paper>

			{/* Post creation prompt for community members */}
			{isLoggedIn && community.isMember && (
				<Paper sx={{ mb: 4 }}>
					<CreatePost defaultCommunityPublicId={community.publicId} />
				</Paper>
			)}

			<Box>
				<Typography variant="h5" sx={{ mb: 2 }}>
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
	);
};

export default CommunityDetails;
