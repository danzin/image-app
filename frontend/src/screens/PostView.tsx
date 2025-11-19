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
	CircularProgress,
	Chip,
	Alert,
	IconButton,
	Avatar,
	Modal,
	useTheme,
	alpha,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
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
	const theme = useTheme();

	const { data: post, isLoading, isError, error } = usePostById(id || "");
	const { mutate: likePostMutation } = useLikePost();
	const deleteMutation = useDeletePost();
	const queryClient = useQueryClient();

	const [isFavorited, setIsFavorited] = useState<boolean>(post?.isFavoritedByViewer ?? false);
	const [isImageModalOpen, setIsImageModalOpen] = useState(false);

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
			<Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
				<CircularProgress />
			</Box>
		);
	}

	if (isError || !post) {
		return (
			<Box sx={{ mt: 4, px: 2 }}>
				<Alert severity="error">Error loading post: {error?.message || "Post not found"}</Alert>
				<Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
					Go Back
				</Button>
			</Box>
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
		<Box sx={{ minHeight: "100%", bgcolor: "background.default" }}>
			{/* Sticky Header */}
			<Box
				sx={{
					position: "sticky",
					top: 0,
					zIndex: 1000,
					bgcolor: "rgba(0, 0, 0, 0.65)",
					backdropFilter: "blur(12px)",
					borderBottom: `1px solid ${theme.palette.divider}`,
					px: 2,
					py: 1,
					display: "flex",
					alignItems: "center",
					gap: 3,
				}}
			>
				<IconButton onClick={() => navigate(-1)} size="small">
					<ArrowBackIcon />
				</IconButton>
				<Typography variant="h6" fontWeight={700}>
					Post
				</Typography>
			</Box>

			<Box sx={{ px: 2, py: 2 }}>
				{/* User Info */}
				<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
					<Box sx={{ display: "flex", gap: 1.5 }}>
						<Avatar
							component={RouterLink}
							to={profileHref}
							src={avatarUrl}
							sx={{ width: 40, height: 40, cursor: "pointer" }}
						>
							{!avatarUrl && <span>{displayName.charAt(0).toUpperCase()}</span>}
						</Avatar>
						<Box>
							<Typography
								component={RouterLink}
								to={profileHref}
								variant="subtitle1"
								sx={{
									fontWeight: 700,
									color: "text.primary",
									textDecoration: "none",
									lineHeight: 1.2,
									"&:hover": { textDecoration: "underline" },
								}}
							>
								{displayName}
							</Typography>
							<Typography variant="body2" color="text.secondary">
								@{post.user?.username}
							</Typography>
						</Box>
					</Box>
					{isOwner && (
						<IconButton size="small" color="error" onClick={handleDeletePost} disabled={deleteMutation.isPending}>
							<DeleteIcon fontSize="small" />
						</IconButton>
					)}
				</Box>

				{/* Post Body */}
				{post.body && (
					<Typography
						variant="body1"
						sx={{
							mt: 2,
							fontSize: "1.05rem",
							lineHeight: 1.5,
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
						}}
					>
						<HashtagText text={post.body} />
					</Typography>
				)}

				{/* Image */}
				{hasImage && (
					<Box
						sx={{
							mt: 2,
							borderRadius: 4,
							overflow: "hidden",
							border: `1px solid ${theme.palette.divider}`,
							cursor: "pointer",
							maxHeight: "600px",
							width: "100%",
							display: "flex",
							justifyContent: "center",
							bgcolor: "black",
						}}
						onClick={() => setIsImageModalOpen(true)}
					>
						<img
							src={fullImageUrl}
							alt="Post content"
							style={{
								width: "100%",
								height: "auto",
								maxHeight: "600px",
								objectFit: "contain",
								display: "block",
							}}
						/>
					</Box>
				)}

				{/* Date */}
				<Box sx={{ mt: 2, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
					<Typography variant="body2" color="text.secondary">
						{new Date(post.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
						{new Date(post.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} ·{" "}
						<span style={{ color: theme.palette.text.primary, fontWeight: 600 }}>{post.viewsCount || 0}</span> Views
					</Typography>
				</Box>

				{/* Stats (Likes/Comments) */}
				{(post.likes > 0 || post.commentsCount > 0) && (
					<Box sx={{ py: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, display: "flex", gap: 3 }}>
						{post.likes > 0 && (
							<Typography variant="body2" color="text.secondary">
								<span style={{ color: theme.palette.text.primary, fontWeight: 700 }}>{post.likes}</span> Likes
							</Typography>
						)}
						{post.commentsCount > 0 && (
							<Typography variant="body2" color="text.secondary">
								<span style={{ color: theme.palette.text.primary, fontWeight: 700 }}>{post.commentsCount}</span>{" "}
								Comments
							</Typography>
						)}
					</Box>
				)}

				{/* Action Buttons */}
				<Box
					sx={{
						py: 1,
						borderBottom: `1px solid ${theme.palette.divider}`,
						display: "flex",
						justifyContent: "space-around",
					}}
				>
					<IconButton onClick={handleLikePost} color={isLiked ? "error" : "default"}>
						{isLiked ? <FavoriteIcon /> : <FavoriteBorderIcon />}
					</IconButton>
					<IconButton onClick={handleToggleFavorite} color={isFavorited ? "primary" : "default"}>
						{isFavorited ? <BookmarkIcon /> : <BookmarkBorderIcon />}
					</IconButton>
				</Box>

				{/* Tags */}
				{post.tags && post.tags.length > 0 && (
					<Box sx={{ mt: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
						{post.tags.map((tag, index) => (
							<Chip
								key={index}
								label={tag}
								size="small"
								onClick={() => navigate(`/results?q=${tag}`)}
								sx={{
									bgcolor: "transparent",
									border: `1px solid ${theme.palette.divider}`,
									color: "primary.main",
									fontWeight: 600,
									"&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.1) },
								}}
							/>
						))}
					</Box>
				)}

				{/* Comment Section */}
				<Box sx={{ mt: 2 }}>
					<CommentSection postId={post.publicId} commentsCount={post.commentsCount} />
				</Box>
			</Box>

			{/* Image Modal */}
			<Modal
				open={isImageModalOpen}
				onClose={() => setIsImageModalOpen(false)}
				sx={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					bgcolor: "rgba(0, 0, 0, 0.9)",
					backdropFilter: "blur(5px)",
				}}
			>
				<Box sx={{ position: "relative", maxWidth: "100vw", maxHeight: "100vh", outline: "none", p: 2 }}>
					<IconButton
						onClick={() => setIsImageModalOpen(false)}
						sx={{
							position: "absolute",
							top: 20,
							right: 20,
							color: "white",
							bgcolor: "rgba(0, 0, 0, 0.5)",
							"&:hover": { bgcolor: "rgba(0, 0, 0, 0.7)" },
							zIndex: 1,
						}}
					>
						<CloseIcon />
					</IconButton>
					<img
						src={fullImageUrl}
						alt="Full size"
						style={{
							maxWidth: "100%",
							maxHeight: "90vh",
							objectFit: "contain",
							display: "block",
							borderRadius: 8,
						}}
					/>
				</Box>
			</Modal>
		</Box>
	);
};

export default PostView;
