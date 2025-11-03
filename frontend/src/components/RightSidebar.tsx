import React from "react";
import { Box, useTheme, useMediaQuery, Typography } from "@mui/material";
import WhoToFollow from "./WhoToFollow";
import SearchBox from "./SearchBox";
import TrendingTags from "./TrendingTags";
import { useAuth } from "../hooks/context/useAuth";

const RightSidebar: React.FC = () => {
	const theme = useTheme();
	const isLargeScreen = useMediaQuery(theme.breakpoints.up("lg"));
	const { isLoggedIn } = useAuth();

	if (!isLargeScreen) {
		return null;
	}

	return (
		<Box
			component="aside"
			sx={{
				width: 340,
				flexShrink: 0,
				p: 3,
				overflowY: "auto",
				height: "100vh",
				bgcolor: "background.default",
				display: "flex",
				flexDirection: "column",
				gap: 3,
			}}
		>
			{/* Search Box */}
			<Box>
				<SearchBox />
			</Box>

			{/* Trending Tags */}
			<Box>
				<TrendingTags />
			</Box>

			{/* Who to Follow - only shown when logged in */}
			{isLoggedIn && (
				<Box>
					<WhoToFollow limit={5} />
				</Box>
			)}

			{/* Login prompt for non-authenticated users */}
			{!isLoggedIn && (
				<Box
					sx={{
						p: 3,
						borderRadius: 3,
						background: "linear-gradient(145deg, rgba(26, 26, 46, 0.6) 0%, rgba(22, 33, 62, 0.6) 100%)",
						border: "1px solid rgba(99, 102, 241, 0.2)",
						textAlign: "center",
					}}
				>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						Join Peek to discover more
					</Typography>
					<Typography variant="caption" color="text.secondary">
						Create an account to follow users and personalize your feed
					</Typography>
				</Box>
			)}
		</Box>
	);
};

export default RightSidebar;
