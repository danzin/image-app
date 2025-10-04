import { useEffect, useState } from "react";
import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useImageById } from "../hooks/images/useImages";
import { useLikeImage } from "../hooks/user/useUserAction";
import { useAuth } from "../hooks/context/useAuth";
import { useDeleteImage } from "../hooks/images/useImages";
import {
	Box,
	Typography,
	Button,
	Container,
	Paper,
	Divider,
	CircularProgress,
	Chip,
	Card,
	CardMedia,
	CardContent,
	Alert,
	IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import CommentSection from "../components/comments/CommentSection";
import { addFavorite, removeFavorite } from "../api/favoritesApi";
import { IImage } from "../types";

const BASE_URL = "/api";

const ImageView = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { user, isLoggedIn } = useAuth();

	const { data: image, isLoading, isError, error } = useImageById(id || "");
	const { mutate: likeImage } = useLikeImage();
	const deleteMutation = useDeleteImage();
	const queryClient = useQueryClient();

	const [isFavorited, setIsFavorited] = useState<boolean>(image?.isFavoritedByViewer ?? false);

	useEffect(() => {
		setIsFavorited(image?.isFavoritedByViewer ?? false);
	}, [image?.publicId, image?.isFavoritedByViewer]);

	const toggleFavoriteMutation = useMutation({
		mutationFn: async (shouldFavorite: boolean) => {
			if (!image) return;
			if (shouldFavorite) {
				await addFavorite(image.publicId);
			} else {
				await removeFavorite(image.publicId);
			}
		},
		onMutate: async (shouldFavorite) => {
			if (!image) return;
			await queryClient.cancelQueries({ queryKey: ["image", image.publicId] });
			setIsFavorited(shouldFavorite);

			const previousImage = queryClient.getQueryData<IImage>(["image", image.publicId]);

			queryClient.setQueryData<IImage>(["image", image.publicId], (old) =>
				old ? { ...old, isFavoritedByViewer: shouldFavorite } : old
			);

			return { previousImage };
		},
		onError: (_err, _shouldFavorite, context) => {
			if (!image) return;
			if (context?.previousImage) {
				queryClient.setQueryData(["image", image.publicId], context.previousImage);
				setIsFavorited(context.previousImage.isFavoritedByViewer ?? false);
			} else {
				setIsFavorited((prev) => !prev);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["favorites", "user"] });
		},
		onSettled: () => {
			if (!image) return;
			queryClient.invalidateQueries({ queryKey: ["image", image.publicId] });
		},
	});

	if (isLoading) {
		return (
			<Container maxWidth="md" sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
				<CircularProgress />
			</Container>
		);
	}

	if (isError || !image) {
		return (
			<Container maxWidth="md" sx={{ mt: 4 }}>
				<Alert severity="error">Error loading image: {error?.message || "Image not found"}</Alert>
				<Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
					Go Back
				</Button>
			</Container>
		);
	}

	const isOwner = isLoggedIn && user?.publicId === image.user.publicId;
	const isLiked = isLoggedIn && image.isLikedByViewer; // Check if current user has liked this image
	console.log(`IS LIKED: ${isLiked}, User: ${user?.publicId}, Image Owner: ${image.user.publicId}`);
	console.log(`Full image object:`, image);
	console.log(`isLikedByViewer property:`, image.isLikedByViewer);
	const fullImageUrl = image.url.startsWith("http")
		? image.url
		: image.url.startsWith("/")
		? `${BASE_URL}${image.url}`
		: `${BASE_URL}/${image.url}`;

	const handleLikeImage = () => {
		if (!isLoggedIn) return navigate("/login");
		likeImage(image.publicId);
	};

	const handleToggleFavorite = () => {
		if (!isLoggedIn) return navigate("/login");
		toggleFavoriteMutation.mutate(!isFavorited);
	};

	const handleDeleteImage = () => {
		if (isOwner) {
			deleteMutation.mutate(image.publicId, {
				onSuccess: () => navigate(-1),
				onError: (err) => console.error("Delete failed", err),
			});
		}
	};

	return (
		<Container maxWidth="md" sx={{ my: 4 }}>
			<Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2 }}>
				Go Back
			</Button>

			<Paper elevation={2} sx={{ overflow: "hidden" }}>
				<Box sx={{ p: { xs: 2, sm: 3 } }}>
					<Card sx={{ boxShadow: "none" }}>
						<CardMedia
							component="img"
							sx={{ maxHeight: "70vh", objectFit: "contain", width: "100%" }}
							image={fullImageUrl}
							alt={image.publicId || "Image"}
						/>

						<CardContent sx={{ pt: 2 }}>
							<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
								<Typography variant="body2" color="text.secondary">
									Uploaded {new Date(image.createdAt).toLocaleDateString()} by{" "}
									<Typography
										component={RouterLink}
										to={`/profile/${image.user.username}`}
										sx={{ color: "primary.main", textDecoration: "none" }}
									>
										{image.user.username}
									</Typography>
								</Typography>

								<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
									<IconButton onClick={handleLikeImage} color="error" size="medium" disabled={!isLoggedIn}>
										{isLiked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
									</IconButton>
									<IconButton
										onClick={handleToggleFavorite}
										color="primary"
										size="medium"
										disabled={!isLoggedIn || toggleFavoriteMutation.isPending}
									>
										{isFavorited ? <BookmarkIcon /> : <BookmarkBorderIcon />}
									</IconButton>

									{isOwner && (
										<Button
											variant="outlined"
											color="error"
											size="small"
											startIcon={<DeleteIcon />}
											onClick={handleDeleteImage}
											disabled={deleteMutation.isPending}
										>
											{deleteMutation.isPending ? "Deleting…" : "Delete"}
										</Button>
									)}
								</Box>
							</Box>

							{image.tags && image.tags.length > 0 && (
								<Box sx={{ mt: 2 }}>
									<Typography variant="subtitle2" gutterBottom>
										Tags:
									</Typography>
									<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
										{image.tags.map((tag, index) => (
											<Chip key={index} label={tag} size="small" onClick={() => navigate(`/results?q=${tag}`)} />
										))}
									</Box>
								</Box>
							)}
						</CardContent>
					</Card>
				</Box>

				<Divider />

				{/* Comment section */}
				<Box sx={{ p: { xs: 2, sm: 3 } }}>
					<CommentSection imageId={image.publicId} commentsCount={image.commentsCount} />
				</Box>
			</Paper>
		</Container>
	);
};

export default ImageView;
