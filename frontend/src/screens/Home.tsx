import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { usePosts } from "../hooks/posts/usePosts";
import Gallery from "../components/Gallery";
import CreatePost from "../components/CreatePost";
import { Box, Button, Typography, Container, alpha } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const Home: React.FC = () => {
	const theme = useTheme();

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
		<Box sx={{ display: "flex", flexGrow: 1, height: "100%", overflow: "hidden" }}>
			<Box
				component="main"
				sx={{
					flexGrow: 1,
					overflowY: "auto",
					height: "100%",
					display: "flex",
					flexDirection: "column",
				}}
			>
				{/* CreatePost decides whether it should render or not */}
				<CreatePost />

				<Box
					sx={{
						flexGrow: 1,
						p: { xs: 2, sm: 3, md: 4 },
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
					}}
				>
					{/* Visitor hero when there are no posts at all */}
					{activePosts.length === 0 && !isLoading && !error && (
						<motion.div
							initial={{ opacity: 0, y: 30 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6 }}
							style={{ width: "100%", maxWidth: "800px", marginBottom: "2rem" }}
						>
							<Container maxWidth="md" sx={{ textAlign: "center", py: 6 }}>
								<Typography
									variant="h2"
									sx={{
										mb: 3,
										background: "linear-gradient(45deg, #6366f1, #ec4899)",
										backgroundClip: "text",
										WebkitBackgroundClip: "text",
										color: "transparent",
										fontWeight: 800,
										fontSize: { xs: "2.5rem", md: "3.5rem" },
									}}
								>
									Welcome to Peek
								</Typography>
								<Typography
									variant="h6"
									sx={{ mb: 4, color: "text.secondary", fontSize: { xs: "1.1rem", md: "1.25rem" }, lineHeight: 1.6 }}
								>
									Discover and share images, have a laugh or a discussion.
								</Typography>
								<Box sx={{ display: "flex", gap: 2, justifyContent: "center", flexWrap: "wrap" }}>
									<Button
										variant="contained"
										size="large"
										href="/register"
										sx={{
											background: "linear-gradient(45deg, #6366f1, #8b5cf6)",
											px: 4,
											py: 1.5,
											fontSize: "1.1rem",
											"&:hover": {
												background: "linear-gradient(45deg, #4f46e5, #7c3aed)",
												transform: "translateY(-2px)",
											},
										}}
									>
										Join Peek
									</Button>
									<Button
										variant="outlined"
										size="large"
										href="/login"
										sx={{
											borderColor: alpha(theme.palette.primary.main, 0.5),
											color: theme.palette.primary.light,
											px: 4,
											py: 1.5,
											fontSize: "1.1rem",
											"&:hover": {
												borderColor: theme.palette.primary.main,
												backgroundColor: alpha(theme.palette.primary.main, 0.1),
												transform: "translateY(-2px)",
											},
										}}
									>
										Sign In
									</Button>
								</Box>
							</Container>
						</motion.div>
					)}

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
		</Box>
	);
};

export default Home;
