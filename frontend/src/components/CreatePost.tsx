import React, { useState, useRef, useMemo } from "react";
import {
	Box,
	Avatar,
	TextField,
	Button,
	IconButton,
	useTheme,
	FormControl,
	Select,
	MenuItem,
	InputLabel,
	Typography,
	Autocomplete,
	CircularProgress,
} from "@mui/material";
import { Image as ImageIcon, Close as CloseIcon, Public as PublicIcon, Group as GroupIcon } from "@mui/icons-material";
import { useAuth } from "../hooks/context/useAuth";
import { useUploadPost } from "../hooks/posts/usePosts";
import { useUserCommunities } from "../hooks/communities/useCommunities";
import { useTranslation } from "react-i18next";
import { ICommunity } from "../types";

interface CreatePostProps {
	onClose?: () => void; // optional callback when post is successfully created for usage in modal
	defaultCommunityPublicId?: string; // pre-select a community when posting from community page
}

const CreatePost: React.FC<CreatePostProps> = ({ onClose, defaultCommunityPublicId }) => {
	const { t } = useTranslation();
	const theme = useTheme();
	const { user, isLoggedIn } = useAuth();
	const uploadPostMutation = useUploadPost();

	const fileInputRef = useRef<HTMLInputElement>(null);

	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string>("");

	const [content, setContent] = useState<string>("");
	const [tags, setTags] = useState<string[]>([]);

	// community selection state - null means personal post, string means community post
	const [selectedCommunityPublicId, setSelectedCommunityPublicId] = useState<string | null>(
		defaultCommunityPublicId || null
	);
	const [communitySearchOpen, setCommunitySearchOpen] = useState(false);

	// fetch user's communities for the dropdown
	const { data: communitiesData, isLoading: isLoadingCommunities, fetchNextPage, hasNextPage } = useUserCommunities();

	const userCommunities = useMemo(() => {
		return communitiesData?.pages.flatMap((page) => page.data) ?? [];
	}, [communitiesData]);

	const selectedCommunity = useMemo(() => {
		if (!selectedCommunityPublicId) return null;
		return userCommunities.find((c) => c.publicId === selectedCommunityPublicId) || null;
	}, [selectedCommunityPublicId, userCommunities]);

	const BASE_URL = "/api";
	const avatarPath = user?.avatar || "";
	const fullAvatarUrl = avatarPath.startsWith("http")
		? avatarPath
		: avatarPath.startsWith("/")
			? `${BASE_URL}${avatarPath}`
			: avatarPath
				? `${BASE_URL}/${avatarPath}`
				: undefined;

	if (!isLoggedIn) {
		return null;
	}

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
		// Must have either text or image
		if (!file && !content.trim()) {
			alert(t("post.error_empty"));
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

		// add community selection if posting to a community
		if (selectedCommunityPublicId) {
			formData.append("communityPublicId", selectedCommunityPublicId);
		}

		try {
			await uploadPostMutation.mutateAsync(formData);
			setContent("");
			setTags([]);
			setFile(null);
			setPreview("");
			setSelectedCommunityPublicId(defaultCommunityPublicId || null);
			if (fileInputRef.current) fileInputRef.current.value = "";

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
					src={fullAvatarUrl}
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
						placeholder={t("post.placeholder")}
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
								alt={t("post.preview")}
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

					{/* Community Selector */}
					<Box sx={{ mt: 2 }}>
						<Autocomplete
							open={communitySearchOpen}
							onOpen={() => setCommunitySearchOpen(true)}
							onClose={() => setCommunitySearchOpen(false)}
							options={userCommunities}
							loading={isLoadingCommunities}
							getOptionLabel={(option: ICommunity) => option.name}
							value={selectedCommunity}
							onChange={(_, newValue) => {
								setSelectedCommunityPublicId(newValue?.publicId || null);
							}}
							isOptionEqualToValue={(option, value) => option.publicId === value.publicId}
							ListboxProps={{
								onScroll: (event) => {
									const listboxNode = event.currentTarget;
									if (
										listboxNode.scrollTop + listboxNode.clientHeight >= listboxNode.scrollHeight - 50 &&
										hasNextPage
									) {
										fetchNextPage();
									}
								},
							}}
							renderOption={(props, option) => (
								<Box
									component="li"
									{...props}
									key={option.publicId}
									sx={{ display: "flex", alignItems: "center", gap: 1 }}
								>
									<Avatar src={option.avatar || undefined} sx={{ width: 24, height: 24 }}>
										{option.name.charAt(0)}
									</Avatar>
									<Typography variant="body2">{option.name}</Typography>
								</Box>
							)}
							renderInput={(params) => (
								<TextField
									{...params}
									placeholder={t("post.select_community", "Post to...")}
									variant="outlined"
									size="small"
									InputProps={{
										...params.InputProps,
										startAdornment: (
											<Box sx={{ display: "flex", alignItems: "center", mr: 1 }}>
												{selectedCommunity ? (
													<GroupIcon fontSize="small" color="primary" />
												) : (
													<PublicIcon fontSize="small" color="action" />
												)}
											</Box>
										),
										endAdornment: (
											<>
												{isLoadingCommunities ? <CircularProgress color="inherit" size={16} /> : null}
												{params.InputProps.endAdornment}
											</>
										),
									}}
								/>
							)}
							noOptionsText={
								userCommunities.length === 0
									? t("post.no_communities", "Join a community to post there")
									: t("post.no_matching_community", "No matching community")
							}
						/>
						<Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
							{selectedCommunity
								? t("post.posting_to_community", "Posting to {{community}}", { community: selectedCommunity.name })
								: t("post.posting_personal", "Posting to your personal feed")}
						</Typography>
					</Box>

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
							{uploadPostMutation.isPending ? t("post.posting") : t("post.post_button")}
						</Button>
					</Box>
				</Box>
			</Box>
		</Box>
	);
};

export default CreatePost;
