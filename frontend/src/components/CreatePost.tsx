import React, { useState, useRef } from "react";
import { Box, Avatar, TextField, Button, IconButton, useTheme } from "@mui/material";
import { Image as ImageIcon, Close as CloseIcon } from "@mui/icons-material";
import { useAuth } from "../hooks/context/useAuth";
import { useUploadPost } from "../hooks/posts/usePosts";

interface CreatePostProps {
	onClose?: () => void; // optional callback when post is successfully created for usage in modal
}

const CreatePost: React.FC<CreatePostProps> = ({ onClose }) => {
	const theme = useTheme();
	const { user } = useAuth();
	const uploadPostMutation = useUploadPost();

	const fileInputRef = useRef<HTMLInputElement>(null);

	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string>("");

	const [content, setContent] = useState<string>("");
	const [tags, setTags] = useState<string[]>([]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			const selectedFile = e.target.files[0];
			setFile(selectedFile);

			//image preview
			const reader = new FileReader();
			reader.onload = (e) => {
				setPreview(e.target?.result as string);
			};
			reader.readAsDataURL(selectedFile);
		}
	};

	const handleUpload = async () => {
		// Validation: must have either text or image
		if (!file && !content.trim()) {
			alert("Please provide either text content or an image");
			return;
		}

		const formData = new FormData();

		if (file) {
			formData.append("image", file);
		}
		if (content.trim()) {
			formData.append("body", content.trim());
		}
		formData.append("tags", JSON.stringify(tags));

		try {
			await uploadPostMutation.mutateAsync(formData);
			// Reset form on success
			setContent("");
			setTags([]);
			setFile(null);
			setPreview("");
			if (fileInputRef.current) fileInputRef.current.value = "";

			// Call onClose if provided (in modal)
			if (onClose) {
				onClose();
			}
		} catch (error) {
			console.error("Upload failed:", error);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.ctrlKey && e.key === "Enter" && !isDisabled) {
			e.preventDefault();
			handleUpload();
		}
	};

	const isDisabled = (!file && !content.trim()) || uploadPostMutation.isPending;

	return (
		<Box
			sx={{
				p: 3,
				borderBottom: `1px solid ${theme.palette.divider}`,
			}}
		>
			<Box sx={{ display: "flex", gap: 2 }}>
				<Avatar
					src={user?.avatar}
					alt={user?.username}
					sx={{
						width: 48,
						height: 48,
					}}
				/>
				<Box sx={{ flex: 1 }}>
					<TextField
						multiline
						rows={2}
						placeholder="What is happening?!"
						value={content}
						onChange={(e) => setContent(e.target.value)}
						onKeyDown={handleKeyDown}
						variant="standard"
						fullWidth
						InputProps={{
							disableUnderline: true,
							sx: {
								fontSize: "1.25rem",
								color: "text.primary",
								"& textarea": {
									"&::placeholder": {
										color: "text.secondary",
										opacity: 0.7,
									},
								},
							},
						}}
						sx={{
							"& .MuiInputBase-root": {
								backgroundColor: "transparent",
							},
						}}
					/>

					{/* Image Preview */}
					{preview && (
						<Box sx={{ mt: 2, position: "relative" }}>
							<img
								src={preview}
								alt="Preview"
								style={{
									width: "100%",
									maxHeight: "300px",
									objectFit: "cover",
									borderRadius: "8px",
									border: `1px solid ${theme.palette.divider}`,
								}}
							/>
							<IconButton
								onClick={() => {
									setPreview("");
									setFile(null);
									if (fileInputRef.current) fileInputRef.current.value = "";
								}}
								sx={{
									position: "absolute",
									top: 8,
									right: 8,
									backgroundColor: "rgba(0, 0, 0, 0.5)",
									color: "white",
									"&:hover": {
										backgroundColor: "rgba(0, 0, 0, 0.7)",
									},
								}}
								size="small"
							>
								<CloseIcon fontSize="small" />
							</IconButton>
						</Box>
					)}

					<Box
						sx={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							mt: 2,
						}}
					>
						<Box sx={{ display: "flex", gap: 0.5 }}>
							<IconButton
								onClick={() => fileInputRef.current?.click()}
								sx={{
									color: "primary.main",
									"&:hover": {
										backgroundColor: "rgba(29, 155, 240, 0.1)",
									},
								}}
							>
								<ImageIcon />
							</IconButton>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								style={{ display: "none" }}
								onChange={handleFileChange}
							/>
						</Box>
						<Button
							variant="contained"
							onClick={handleUpload}
							disabled={isDisabled}
							sx={{
								borderRadius: 20,
								textTransform: "none",
								fontWeight: 600,
								px: 3,
								py: 1,
								bgcolor: "primary.main",
								"&:hover": {
									bgcolor: "primary.dark",
								},
								"&:disabled": {
									opacity: 0.5,
								},
							}}
						>
							{uploadPostMutation.isPending ? "Posting..." : "Post"}
						</Button>
					</Box>
				</Box>
			</Box>
		</Box>
	);
};

export default CreatePost;
