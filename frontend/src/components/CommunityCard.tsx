import React from "react";
import { Card, CardContent, Typography, Button, Box, Avatar } from "@mui/material";
import { ICommunity } from "../types";
import { useNavigate } from "react-router-dom";
import { useJoinCommunity, useLeaveCommunity } from "../hooks/communities/useCommunity";
import { useAuth } from "../hooks/context/useAuth";

interface CommunityCardProps {
	community: ICommunity;
}

const CommunityCard: React.FC<CommunityCardProps> = ({ community }) => {
	const navigate = useNavigate();
	const { isLoggedIn } = useAuth();
	const { mutate: joinCommunity, isPending: isJoining } = useJoinCommunity();
	const { mutate: leaveCommunity, isPending: isLeaving } = useLeaveCommunity();

	const handleJoin = (e: React.MouseEvent) => {
		e.stopPropagation();
		joinCommunity(community.publicId);
	};

	const handleLeave = (e: React.MouseEvent) => {
		e.stopPropagation();
		leaveCommunity(community.publicId);
	};

	return (
		<Card sx={{ mb: 2, cursor: "pointer" }} onClick={() => navigate(`/communities/${community.slug}`)}>
			<CardContent>
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 1 }}>
					<Avatar src={community.avatar || undefined} sx={{ width: 48, height: 48 }}>
						{community.name.charAt(0).toUpperCase()}
					</Avatar>
					<Box sx={{ flex: 1 }}>
						<Typography variant="h6">{community.name}</Typography>
						<Typography variant="caption" color="text.secondary">
							{community.stats.memberCount} members • {community.stats.postCount} posts
						</Typography>
					</Box>
					{isLoggedIn && (
						<Box>
							{community.isMember ? (
								<Button size="small" variant="outlined" color="secondary" onClick={handleLeave} disabled={isLeaving}>
									{isLeaving ? "Leaving..." : "Leave"}
								</Button>
							) : (
								<Button size="small" variant="contained" onClick={handleJoin} disabled={isJoining}>
									{isJoining ? "Joining..." : "Join"}
								</Button>
							)}
						</Box>
					)}
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ ml: 7 }}>
					{community.description}
				</Typography>
			</CardContent>
		</Card>
	);
};

export default CommunityCard;
