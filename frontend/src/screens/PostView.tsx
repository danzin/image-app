import { useEffect, useState } from "react";
import { useParams, Link as RouterLink, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePostById } from "../hooks/posts/usePosts";
import { useLikePost } from "../hooks/user/useUserAction";
import { useAuth } from "../hooks/context/useAuth";
import { useDeletePost } from "../hooks/posts/usePosts";
import HashtagText from "../components/HashtagText";
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
	CardContent,
	Alert,
	IconButton,
	Avatar,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BookmarkIcon from "@mui/icons-material/Bookmark";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import CommentSection from "../components/comments/CommentSection";
import { addFavorite, removeFavorite } from "../api/favoritesApi";
import { IPost } from "../types";

const BASE_URL = "/api";

const PostView = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const { user, isLoggedIn } = useAuth();

	const { data: post, isLoading, isError, error } = usePostById(id || "");
	const { mutate: likePostMutation } = useLikePost();
	const deleteMutation = useDeletePost();
	const queryClient = useQueryClient();

	const [isFavorited, setIsFavorited] = useState<boolean>(post?.isFavoritedByViewer ?? false);

	useEffect(() => {
		setIsFavorited(post?.isFavoritedByViewer ?? false);
	}, [post?.publicId, post?.isFavoritedByViewer]);

	const toggleFavoriteMutation = useMutation({
		mutationFn: async (shouldFavorite: boolean) => {
			if (!post) return;
			if (shouldFavorite) {
				await addFavorite(post.publicId);
			} else {
				await removeFavorite(post.publicId);
			}
		},
		onMutate: async (shouldFavorite) => {
			if (!post) return;
			await queryClient.cancelQueries({ queryKey: ["post", post.publicId] });
			setIsFavorited(shouldFavorite);

			const previousPost = queryClient.getQueryData<IPost>(["post", post.publicId]);

			queryClient.setQueryData<IPost>(["post", post.publicId], (old) =>
				old ? { ...old, isFavoritedByViewer: shouldFavorite } : old
			);

			return { previousPost };
		},
		onError: (_err, _shouldFavorite, context) => {
			if (!post) return;
			if (context?.previousPost) {
				queryClient.setQueryData(["post", post.publicId], context.previousPost);
				setIsFavorited(context.previousPost.isFavoritedByViewer ?? false);
			} else {
				setIsFavorited((prev) => !prev);
			}
		},
		onSuccess: () => {
			// Don't invalidate immediately - trust the optimistic update
			// Only mark favorites list as stale in background
			setTimeout(() => {
				queryClient.invalidateQueries({
					queryKey: ["favorites", "user"],
					refetchType: "none",
				});
			}, 1000);
		},
		onSettled: () => {
			// Don't invalidate - trust the optimistic update
		},
	});

	if (isLoading) {
		return (
			<Container maxWidth="md" sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
				<CircularProgress />
			</Container>
		);
	}

	if (isError || !post) {
		return (
			<Container maxWidth="md" sx={{ mt: 4 }}>
				<Alert severity="error">Error loading post: {error?.message || "Post not found"}</Alert>
				<Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
					Go Back
				</Button>
			</Container>
		);
	}

	const isOwner = isLoggedIn && user?.publicId === post.user.publicId;
	const isLiked = isLoggedIn && post.isLikedByViewer;

	const buildMediaUrl = (value?: string) => {
		if (!value) return undefined;
		if (value.startsWith("http")) return value;
		return value.startsWith("/") ? `${BASE_URL}${value}` : `${BASE_URL}/${value}`;
	};

	const avatarUrl = buildMediaUrl(post.user?.avatar);
	const displayName = post.user?.username || post.user?.publicId || "Unknown user";
	const profileHref = post.user?.username
		? `/profile/${post.user.username}`
		: post.user?.publicId
			? `/profile/${post.user.publicId}`
			: "/profile";

	// Debug logging
	console.log("[PostView] Post data:", {
		publicId: post.publicId,
		isLikedByViewer: post.isLikedByViewer,
		isFavoritedByViewer: post.isFavoritedByViewer,
		likes: post.likes,
		isLoggedIn,
		isLiked,
	});

	// Handle optional image URL (post might be text-only)
	const fullImageUrl = post.url ? buildMediaUrl(post.url) : buildMediaUrl(post.image?.url);

	const hasImage = !!fullImageUrl;

	const handleLikePost = () => {
		if (!isLoggedIn) return navigate("/login");
		likePostMutation(post.publicId);
	};

	const handleToggleFavorite = () => {
		if (!isLoggedIn) return navigate("/login");
		toggleFavoriteMutation.mutate(!isFavorited);
	};

	const handleDeletePost = () => {
		if (isOwner) {
			deleteMutation.mutate(post.publicId, {
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
						{/* User Info Header */}
						<CardContent sx={{ pb: 1 }}>
							<Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
								<Avatar
									src={avatarUrl}
									sx={{
										width: 48,
										height: 48,
										border: "2px solid rgba(99, 102, 241, 0.3)",
										background: avatarUrl ? "transparent" : "linear-gradient(45deg, #6366f1, #8b5cf6)",
									}}
								>
									{!avatarUrl && <span>{displayName.charAt(0).toUpperCase()}</span>}
								</Avatar>
								<Box sx={{ flex: 1 }}>
									<Typography
										component={RouterLink}
										to={profileHref}
										sx={{
											color: "primary.main",
											textDecoration: "none",
											fontWeight: 600,
											fontSize: "1.1rem",
											"&:hover": { textDecoration: "underline" },
										}}
									>
										{displayName}
									</Typography>
									<Typography variant="body2" color="text.secondary">
										{new Date(post.createdAt).toLocaleDateString(undefined, {
											year: "numeric",
											month: "long",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</Typography>
								</Box>

								{/* Action Buttons */}
								<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
									<IconButton onClick={handleLikePost} color="error" size="medium" disabled={!isLoggedIn}>
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
											onClick={handleDeletePost}
											disabled={deleteMutation.isPending}
										>
											{deleteMutation.isPending ? "Deleting…" : "Delete"}
										</Button>
									)}
								</Box>
							</Box>

							{/* Post Text Content */}
							{post.body && (
								<Box sx={{ mb: hasImage ? 2 : 0 }}>
									<Typography
										variant="body1"
										sx={{
											lineHeight: 1.7,
											whiteSpace: "pre-wrap",
											wordBreak: "break-word",
											fontSize: "1.05rem",
										}}
									>
										<HashtagText text={post.body} />
									</Typography>
								</Box>
							)}
						</CardContent>{" "}
						{/* Image (if post has one) */}
						{hasImage && (
							<Box sx={{ width: "100%" }}>
								<img
									src={fullImageUrl}
									alt={post.body?.substring(0, 50) || post.publicId}
									style={{
										width: "100%",
										maxHeight: "70vh",
										objectFit: "contain",
										display: "block",
									}}
								/>
							</Box>
						)}
						<CardContent sx={{ pt: 2 }}>
							{/* Tags */}
							{post.tags && post.tags.length > 0 && (
								<Box sx={{ mt: 2 }}>
									<Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
										Tags:
									</Typography>
									<Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
										{post.tags.map((tag, index) => (
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
					<CommentSection postId={post.publicId} commentsCount={post.commentsCount} />
				</Box>
			</Paper>
		</Container>
	);
};

export default PostView;
