import React, { useState } from "react";
import { Box, TextField, Button, Avatar, Stack } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { useAuth } from "../../hooks/context/useAuth";
import { useCreateComment } from "../../hooks/comments/useComments";

interface CommentFormProps {
	postId: string;
}

const CommentForm: React.FC<CommentFormProps> = ({ postId }) => {
	const { user, isLoggedIn } = useAuth();
	const [content, setContent] = useState("");
	const createCommentMutation = useCreateComment();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!content.trim() || !isLoggedIn) return;

		try {
			await createCommentMutation.mutateAsync({
				imagePublicId: postId,
				commentData: { content: content.trim() },
			});
			setContent("");
		} catch (error) {
			console.error("Failed to create comment:", error);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.ctrlKey && e.key === "Enter") {
			e.preventDefault();
			const formEvent = new Event("submit", { bubbles: true, cancelable: true });
			handleSubmit(formEvent as unknown as React.FormEvent);
		}
	};

	if (!isLoggedIn) {
		return null;
	}

	return (
		<Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
			<Stack direction="row" spacing={1} alignItems="flex-start">
				<Avatar src={user?.avatar} alt={user?.username} sx={{ width: 32, height: 32, mt: 0.5 }}>
					{user?.username?.[0]?.toUpperCase()}
				</Avatar>

				<Box sx={{ flex: 1 }}>
					<TextField
						fullWidth
						multiline
						maxRows={4}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Write a comment..."
						variant="outlined"
						size="small"
						inputProps={{ maxLength: 500 }}
						disabled={createCommentMutation.isPending}
					/>

					<Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
						<Button
							type="submit"
							variant="contained"
							size="small"
							endIcon={<SendIcon />}
							disabled={createCommentMutation.isPending || !content.trim()}
						>
							{createCommentMutation.isPending ? "Posting..." : "Post"}
						</Button>
					</Box>
				</Box>
			</Stack>
		</Box>
	);
};

export default CommentForm;
