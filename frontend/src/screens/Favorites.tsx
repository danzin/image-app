import { Box, Typography } from "@mui/material";
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
