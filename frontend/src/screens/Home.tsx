import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useImages, useImagesByTag, usePersonalizedFeed } from "../hooks/images/useImages";
import Gallery from "../components/Gallery";
import { Box, Button, Typography, useTheme, Container, alpha } from "@mui/material";

import { useGallery } from "../context/GalleryContext";
import { useAuth } from "../hooks/context/useAuth";
import { shouldShowDiscoveryFirst } from "../lib/userOnboarding";

const Home: React.FC = () => {
	const theme = useTheme();
	const { selectedTags, clearTags } = useGallery();
	const { user, isLoggedIn, loading: authLoading } = useAuth();

	const [authTransitionComplete, setAuthTransitionComplete] = useState(false);

	// no automatic redirect - let new users access Home but show them discovery content
	// they can navigate between Home and Discovery freely

	useEffect(() => {
		if (authLoading) {
			setAuthTransitionComplete(false);
		} else {
			const timer = setTimeout(() => {
				setAuthTransitionComplete(true);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [authLoading, isLoggedIn]);

	// Only enable queries when auth transition is complete
	const personalizedFeedQuery = usePersonalizedFeed();
	const imagesQuery = useImages();
	const imagesByTagQuery = useImagesByTag(selectedTags);

	console.log("Home - Auth state:", { isLoggedIn, user: user?.publicId, authLoading, authTransitionComplete });
	console.log("Home - PersonalizedFeed data:", personalizedFeedQuery.data?.pages?.[0]?.data?.[0]);
	console.log("Home - Images data:", imagesQuery.data?.pages?.[0]?.data?.[0]);

	// show personalized feed only if logged in, auth complete, and NOT a new user
	const isNewUser = shouldShowDiscoveryFirst(user, isLoggedIn);
	const shouldUsePersonalizedFeed = isLoggedIn && authTransitionComplete && !authLoading && !isNewUser;

	const mainQuery = shouldUsePersonalizedFeed ? personalizedFeedQuery : imagesQuery;

	const {
		data: mainFeedData,
		fetchNextPage: fetchNextMain,
		hasNextPage: hasNextMain,
		isFetchingNextPage: isFetchingNextMain,
		isLoading: isLoadingMain,
		error: errorMain,
	} = mainQuery;

	const {
		data: filteredImagesData,
		fetchNextPage: fetchNextFiltered,
		hasNextPage: hasNextFiltered,
		isFetchingNextPage: isFetchingNextFiltered,
		isLoading: isLoadingFiltered,
		error: errorFiltered,
	} = imagesByTagQuery;

	const activeImages = React.useMemo(() => {
		console.log("Home - Computing active images:", {
			selectedTagsCount: selectedTags.length,
			mainFeedPages: mainFeedData?.pages?.length,
			filteredPages: filteredImagesData?.pages?.length,
			shouldUsePersonalizedFeed,
		});

		if (selectedTags.length === 0) {
			const images = mainFeedData?.pages.flatMap((page) => page.data) || [];
			console.log("Home - Using main feed images:", images.length, "first image:", images[0]);
			return images;
		} else {
			const images = filteredImagesData?.pages.flatMap((page) => page.data) || [];
			console.log("Home - Using filtered images:", images.length);
			return images;
		}
	}, [selectedTags, mainFeedData, filteredImagesData, shouldUsePersonalizedFeed]);

	const error = selectedTags.length > 0 ? errorFiltered : errorMain;
	const isFetchingNext = selectedTags.length > 0 ? isFetchingNextFiltered : isFetchingNextMain;
	const fetchNextPage = selectedTags.length > 0 ? fetchNextFiltered : fetchNextMain;
	const hasNextPage = selectedTags.length > 0 ? !!hasNextFiltered : !!hasNextMain;
	const isLoading = selectedTags.length > 0 ? isLoadingFiltered : isLoadingMain;

	// Show loading during auth transitions
	if (authLoading || !authTransitionComplete) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
				<Typography>Loading...</Typography>
			</Box>
		);
	}

	return (
		<Box
			sx={{
				display: "flex",
				flexGrow: 1,
				height: "100%",
				overflow: "hidden",
			}}
		>
			{/* Main Content */}
			<Box
				component="main"
				sx={{
					flexGrow: 1,
					p: { xs: 2, sm: 3, md: 4 },
					overflowY: "auto",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				{/* Welcome Section */}
				{!isLoggedIn && activeImages.length === 0 && !isLoading && (
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
								sx={{
									mb: 4,
									color: "text.secondary",
									fontSize: { xs: "1.1rem", md: "1.25rem" },
									lineHeight: 1.6,
								}}
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

				{/* Clear Filter Button */}
				{selectedTags.length > 0 && (
					<Button
						variant="outlined"
						onClick={clearTags}
						sx={{
							mb: 3,
							alignSelf: "flex-start",
							borderColor: "rgba(99, 102, 241, 0.5)",
							color: "primary.light",
							"&:hover": {
								borderColor: "primary.main",
								backgroundColor: alpha(theme.palette.primary.main, 0.1),
							},
						}}
					>
						Clear Tag Filters ({selectedTags.length})
					</Button>
				)}

				{/* Error State */}
				{error ? (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
						<Typography
							color="error"
							sx={{
								textAlign: "center",
								py: 4,
								fontSize: "1.1rem",
							}}
						>
							Error fetching images: {error.message}
						</Typography>
					</motion.div>
				) : (
					/* Gallery */
					<Gallery
						key={shouldUsePersonalizedFeed ? "personalized" : "public"} // Force re-render when switching feed types
						images={activeImages}
						fetchNextPage={fetchNextPage}
						hasNextPage={hasNextPage}
						isFetchingNext={isFetchingNext}
						isLoadingFiltered={isLoadingFiltered}
						isLoadingAll={isLoading}
					/>
				)}
			</Box>
		</Box>
	);
};

export default Home;
