import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { usePosts } from "../hooks/posts/usePosts";
import Gallery from "../components/Gallery";
import CreatePost from "../components/CreatePost";
import { Box, Typography, useMediaQuery, useTheme } from "@mui/material";

const Home: React.FC = () => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));

	// backend picks personalized vs trending based on auth present in the request
	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = usePosts();

	const activePosts = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

	// Loading stat
	if (isLoading) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
				<Typography>Loading...</Typography>
			</Box>
		);
	}

	return (
		<Box sx={{ display: "flex", flexDirection: "column", mt: 2 }}>
			{/* CreatePost decides whether it should render or not - hide on mobile */}
			{!isMobile && <CreatePost />}

			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				{error ? (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
						<Typography color="error" sx={{ textAlign: "center", py: 4, fontSize: "1.1rem" }}>
							Error fetching images: {error.message}
						</Typography>
					</motion.div>
				) : (
					<Gallery
						key={`posts-feed`}
						posts={activePosts}
						fetchNextPage={fetchNextPage}
						hasNextPage={hasNextPage}
						isFetchingNext={isFetchingNextPage}
						isLoadingAll={isLoading}
					/>
				)}
			</Box>
		</Box>
	);
};

export default Home;
