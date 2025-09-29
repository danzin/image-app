import { Box, Typography } from "@mui/material";
import { motion } from "framer-motion";
import Gallery from "../components/Gallery";
import { useFavorites } from "../hooks/favorites/useFavorites";
import { useAuth } from "../hooks/context/useAuth";

const Favorites = () => {
	const { isLoggedIn } = useAuth();
	const favoritesQuery = useFavorites();

	const { data, error, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = favoritesQuery;

	const images = data?.pages.flatMap((page) => page.data) ?? [];

	if (!isLoggedIn) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
				<Typography variant="h6" color="text.secondary">
					You need to be logged in to view your favorites.
				</Typography>
			</Box>
		);
	}

	return (
		<Box
			sx={{
				display: "flex",
				flexGrow: 1,
				flexDirection: "column",
				height: "100%",
				overflow: "hidden",
			}}
		>
			<Box
				sx={{
					flexGrow: 1,
					overflowY: "auto",
					p: { xs: 2, sm: 3, md: 4 },
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4 }}
					style={{ width: "100%", maxWidth: "800px" }}
				>
					<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
						<Typography
							variant="h4"
							sx={{
								fontWeight: 700,
								background: "linear-gradient(45deg, #6366f1, #ec4899)",
								WebkitBackgroundClip: "text",
								color: "transparent",
							}}
						>
							Your Favorites
						</Typography>
					</Box>
				</motion.div>

				{error ? (
					<Box sx={{ textAlign: "center", mt: 6 }}>
						<Typography variant="body1" color="error">
							We couldn't load your favorites: {error.message}
						</Typography>
					</Box>
				) : (
					<Gallery
						images={images}
						fetchNextPage={fetchNextPage}
						hasNextPage={!!hasNextPage}
						isFetchingNext={isFetchingNextPage}
						isLoadingFiltered={false}
						isLoadingAll={isLoading}
						emptyTitle="No favorites yet"
						emptyDescription="Tap the heart icon on any image to save it to your favorites."
					/>
				)}
			</Box>
		</Box>
	);
};

export default Favorites;
