import React, { useState } from "react";
import { Box, Typography, Avatar, IconButton, Menu, MenuItem, TextField, Button, Stack } from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { IComment } from "../../types";
import { useAuth } from "../../hooks/context/useAuth";
import {
	useUpdateComment,
	useDeleteComment,
	useCommentReplies,
	useCreateComment,
	useLikeComment,
} from "../../hooks/comments/useComments";
import { useNavigate } from "react-router";
import RichText from "../RichText";

interface CommentItemProps {
	comment: IComment;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment }) => {
	const { user } = useAuth();
	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(comment.content);

	// Reply state
	const [showReplies, setShowReplies] = useState(false);
	const [showReplyForm, setShowReplyForm] = useState(false);
	const [replyContent, setReplyContent] = useState("");

	const navigate = useNavigate();

	const updateCommentMutation = useUpdateComment();
	const deleteCommentMutation = useDeleteComment();
	const createCommentMutation = useCreateComment();
	const likeCommentMutation = useLikeComment();

	const {
		data: repliesData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: isLoadingReplies,
	} = useCommentReplies(comment.postPublicId, comment.id, 5);

	const isOwner = user?.publicId === comment.user.publicId;
	const isMenuOpen = Boolean(anchorEl);

	const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

	const handleReplySubmit = async () => {
		if (!replyContent.trim()) return;

		try {
			await createCommentMutation.mutateAsync({
				imagePublicId: comment.postPublicId,
				commentData: {
					content: replyContent,
					parentId: comment.id,
				},
			});
			setReplyContent("");
			setShowReplyForm(false);
			setShowReplies(true);
		} catch (error) {
			console.error("Failed to post reply:", error);
		}
	};

	const handleLike = async () => {
		try {
			await likeCommentMutation.mutateAsync({
				commentId: comment.id,
				postPublicId: comment.postPublicId,
			});
		} catch (error) {
			console.error("Failed to like comment:", error);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.ctrlKey && e.key === "Enter") {
			e.preventDefault();
			handleSaveEdit();
		}
	};

	const handleEdit = () => {
		setIsEditing(true);
		setEditContent(comment.content);
		handleMenuClose();
	};

	const handleCancelEdit = () => {
		setIsEditing(false);
		setEditContent(comment.content);
	};

	const handleSaveEdit = async () => {
		if (editContent.trim() === "") return;

		try {
			await updateCommentMutation.mutateAsync({
				commentId: comment.id,
				commentData: { content: editContent.trim() },
			});
			setIsEditing(false);
		} catch (error) {
			console.error("Failed to update comment:", error);
		}
	};

	const handleDelete = async () => {
		if (window.confirm("Are you sure you want to delete this comment?")) {
			try {
				await deleteCommentMutation.mutateAsync({
					commentId: comment.id,
					postPublicId: comment.postPublicId,
				});
			} catch (error) {
				console.error("Failed to delete comment:", error);
			}
		}
		handleMenuClose();
	};

	const formatDate = (dateString: Date) => {
		const date = new Date(dateString);
		const now = new Date();
		const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

		if (diffInHours < 1) {
			const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
			return diffInMinutes < 1 ? "Just now" : `${diffInMinutes}m ago`;
		} else if (diffInHours < 24) {
			return `${diffInHours}h ago`;
		} else {
			const diffInDays = Math.floor(diffInHours / 24);
			return diffInDays === 1 ? "1 day ago" : `${diffInDays} days ago`;
		}
	};

	return (
		<Box sx={{ display: "flex", gap: 1, py: 1 }}>
			<Avatar
				src={comment.user.avatar}
				alt={comment.user.username}
				sx={{ width: 32, height: 32, cursor: "pointer" }}
				onClick={() => navigate(`/profile/${comment.user?.publicId}`)}
			>
				{comment.user?.avatar ? (
					<img
						src={`/api/${comment.user.avatar}`}
						alt={comment.user.username}
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
				) : (
					<span>{comment.user?.username?.charAt(0).toUpperCase()}</span>
				)}
			</Avatar>

			<Box sx={{ flex: 1, minWidth: 0 }}>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
					<Typography
						variant="subtitle2"
						component="span"
						sx={{ fontWeight: 600, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
						onClick={(e) => {
							e.stopPropagation();
							navigate(`/profile/${comment.user?.publicId}`);
						}}
					>
						{comment.user.username}
					</Typography>
					<Typography variant="caption" color="text.secondary">
						{formatDate(comment.createdAt)}
						{comment.isEdited && " (edited)"}
					</Typography>
					{isOwner && (
						<IconButton size="small" onClick={handleMenuClick} sx={{ ml: "auto", p: 0.5 }}>
							<MoreVertIcon fontSize="small" />
						</IconButton>
					)}
				</Box>

				{isEditing ? (
					<Stack spacing={1}>
						<TextField
							fullWidth
							multiline
							maxRows={4}
							value={editContent}
							onKeyDown={handleKeyDown}
							onChange={(e) => setEditContent(e.target.value)}
							variant="outlined"
							size="small"
							placeholder="Write a comment..."
							inputProps={{ maxLength: 500 }}
						/>
						<Box sx={{ display: "flex", gap: 1 }}>
							<Button
								size="small"
								variant="contained"
								startIcon={<SaveIcon />}
								onClick={handleSaveEdit}
								disabled={updateCommentMutation.isPending || editContent.trim() === ""}
							>
								Save
							</Button>
							<Button
								size="small"
								variant="outlined"
								startIcon={<CancelIcon />}
								onClick={handleCancelEdit}
								disabled={updateCommentMutation.isPending}
							>
								Cancel
							</Button>
						</Box>
					</Stack>
				) : (
					<Typography variant="body2" sx={{ wordBreak: "break-word" }}>
						<RichText text={comment.content} />
					</Typography>
				)}

				{/* Actions */}
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 0.5 }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
						<IconButton size="small" onClick={handleLike} sx={{ p: 0.5 }}>
							{comment.isLikedByViewer ? (
								<FavoriteIcon fontSize="small" color="error" />
							) : (
								<FavoriteBorderIcon fontSize="small" />
							)}
						</IconButton>
						{(comment.likesCount || 0) > 0 && (
							<Typography variant="caption" color="text.secondary">
								{comment.likesCount}
							</Typography>
						)}
					</Box>
					<Typography
						variant="caption"
						sx={{ cursor: "pointer", fontWeight: 600, color: "text.secondary" }}
						onClick={() => setShowReplyForm(!showReplyForm)}
					>
						Reply
					</Typography>
				</Box>

				{/* Reply Form */}
				{showReplyForm && (
					<Box sx={{ mt: 1, mb: 2 }}>
						<TextField
							fullWidth
							size="small"
							placeholder={`Reply to ${comment.user.username}...`}
							value={replyContent}
							onChange={(e) => setReplyContent(e.target.value)}
							multiline
						/>
						<Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1 }}>
							<Button size="small" onClick={() => setShowReplyForm(false)}>
								Cancel
							</Button>
							<Button
								size="small"
								variant="contained"
								onClick={handleReplySubmit}
								disabled={!replyContent.trim() || createCommentMutation.isPending}
							>
								Reply
							</Button>
						</Box>
					</Box>
				)}

				{/* View Replies Button */}
				{(comment.replyCount || 0) > 0 && (
					<Box sx={{ mt: 1 }}>
						<Typography
							variant="caption"
							sx={{
								cursor: "pointer",
								color: "primary.main",
								fontWeight: 600,
								display: "flex",
								alignItems: "center",
								gap: 0.5,
							}}
							onClick={() => setShowReplies(!showReplies)}
						>
							{showReplies ? "Hide replies" : `View ${comment.replyCount} replies`}
						</Typography>
					</Box>
				)}

				{/* Replies List */}
				{showReplies && (
					<Box sx={{ mt: 1, pl: 2, borderLeft: "2px solid #eee" }}>
						{isLoadingReplies ? (
							<Typography variant="caption">Loading replies...</Typography>
						) : (
							<>
								{repliesData?.pages.map((page) =>
									page.comments.map((reply) => <CommentItem key={reply.id} comment={reply} />)
								)}
								{hasNextPage && (
									<Button
										size="small"
										onClick={() => fetchNextPage()}
										disabled={isFetchingNextPage}
										sx={{ mt: 1, textTransform: "none" }}
									>
										{isFetchingNextPage ? "Loading..." : "Load more replies"}
									</Button>
								)}
							</>
						)}
					</Box>
				)}
			</Box>

			<Menu
				anchorEl={anchorEl}
				open={isMenuOpen}
				onClose={handleMenuClose}
				transformOrigin={{ horizontal: "right", vertical: "top" }}
				anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
			>
				<MenuItem onClick={handleEdit}>
					<EditIcon fontSize="small" sx={{ mr: 1 }} />
					Edit
				</MenuItem>
				<MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
					<DeleteIcon fontSize="small" sx={{ mr: 1 }} />
					Delete
				</MenuItem>
			</Menu>
		</Box>
	);
};

export default CommentItem;
