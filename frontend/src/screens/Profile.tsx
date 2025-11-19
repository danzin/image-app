import React, { useState, useCallback } from "react";
import {
	Box,
	Button,
	Typography,
	Avatar,
	Modal,
	Paper,
	CircularProgress,
	useTheme,
	IconButton,
	alpha,
	Tabs,
	Tab,
	Tooltip,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { useNavigate, useParams } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import Gallery from "../components/Gallery";
import { EditProfile } from "../components/EditProfile";
import { useGetUser, useUpdateUserAvatar, useUpdateUserCover, useUserPosts } from "../hooks/user/useUsers";
import { useFollowUser, useIsFollowing } from "../hooks/user/useUserAction";
import { useAuth } from "../hooks/context/useAuth";
import ImageEditor from "../components/ImageEditor";
import { useQueryClient } from "@tanstack/react-query";
import { useInitiateConversation } from "../hooks/messaging/useInitiateConversation";

const BASE_URL = "/api";

const Profile: React.FC = () => {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const { user, isLoggedIn } = useAuth();
	const theme = useTheme();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState(0);

	const profileUserId = id || user?.publicId;

	// Data for profile being viewed - use the identifier to get user data
	// If no id is provided in URL and user is logged in, use their data
	const {
		data: profileData,
		isLoading: isLoadingProfile,
		error: getUserError,
	} = useGetUser(id ? id : isLoggedIn ? user?.username : undefined);

	const {
		data: imagesData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: isLoadingImages,
	} = useUserPosts(profileData?.publicId || "", { enabled: !!profileData?.publicId });

	const { data: isFollowing, isLoading: isCheckingFollow } = useIsFollowing(profileData?.publicId || "", {
		enabled: isLoggedIn && !!profileData?.publicId && profileData?.publicId !== user?.publicId,
	});

	// modals state
	const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
	const [isCoverModalOpen, setIsCoverModalOpen] = useState(false);
	const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

	//check if user is the owner of the profile
	const isProfileOwner = isLoggedIn && profileData?.publicId === user?.publicId;

	// mutations
	const avatarMutation = useUpdateUserAvatar();
	const coverMutation = useUpdateUserCover();
	const { mutate: followUserMutation, isPending: followPending } = useFollowUser();
	const initiateConversationMutation = useInitiateConversation();

	const notifySuccess = useCallback((message: string) => toast.success(message), []);
	const notifyError = useCallback((message: string) => toast.error(message), []);

	const flattenedImages = imagesData?.pages?.flatMap((page) => page.data) || [];

	const isLoadingAll = isLoadingImages || imagesData?.pages.length === 0;

	const handleFollowUser = () => {
		if (!isLoggedIn) return navigate("/login");
		if (!profileUserId || !profileData) return;

		followUserMutation(profileData.publicId, {
			onSuccess: () => {
				queryClient.invalidateQueries({ queryKey: ["isFollowing", profileData.publicId] });
				queryClient.invalidateQueries({ queryKey: ["user", profileData.publicId] });
			},
			onError: (error: Error) => {
				notifyError(`Action failed: ${error?.message || "Unknown error"}`);
				console.error("Error following/unfollowing user:", error);
			},
		});
	};

	const handleMessageUser = () => {
		if (!isLoggedIn) {
			navigate("/login");
			return;
		}

		if (!profileData?.publicId || profileData.publicId === user?.publicId) {
			return;
		}

		initiateConversationMutation.mutate(profileData.publicId, {
			onSuccess: (response) => {
				navigate(`/messages?conversation=${response.conversation.publicId}`);
			},
			onError: (error: Error) => {
				notifyError(`Unable to start chat: ${error?.message || "Unknown error"}`);
			},
		});
	};

	// Handler for Avatar upload (receives Blob)
	const handleAvatarUpload = useCallback(
		(croppedImage: Blob | null) => {
			if (!croppedImage) {
				notifyError("Image processing failed.");
				setIsAvatarModalOpen(false);
				return;
			}

			try {
				avatarMutation.mutate(croppedImage, {
					onSuccess: () => notifySuccess("Avatar updated successfully!"),
					onError: (error: Error) => notifyError(`Avatar upload failed: ${error?.message || "Error"}`),
					onSettled: () => setIsAvatarModalOpen(false),
				});
			} catch (error) {
				notifyError("Error processing image");
				console.error("Error converting dataURL to Blob:", error);
			}
		},
		[avatarMutation, notifyError, notifySuccess]
	);

	// Handler for Cover upload (receives Blob)
	const handleCoverUpload = useCallback(
		(croppedImage: Blob | null) => {
			if (!croppedImage) {
				notifyError("Image processing failed.");
				setIsAvatarModalOpen(false);
				return;
			}
			try {
				coverMutation.mutate(croppedImage, {
					onSuccess: () => notifySuccess("Cover photo updated successfully!"),
					onError: (error: Error) => notifyError(`Cover upload failed: ${error?.message || "Error"}`),
					onSettled: () => setIsCoverModalOpen(false),
				});
			} catch (error) {
				notifyError("Error processing image");
				console.error("Error converting dataURL to Blob:", error);
			}
		},
		[coverMutation, notifyError, notifySuccess]
	);

	// Loading state
	if (isLoadingProfile) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "calc(100vh - 64px)" }}>
				<CircularProgress />
			</Box>
		);
	}

	if (getUserError) {
		return (
			<Box sx={{ p: 3, textAlign: "center" }}>
				<Typography color="error">
					Error loading profile: {(getUserError as Error)?.message || "Unknown error"}
				</Typography>
			</Box>
		);
	}

	if (!profileData) {
		return (
			<Box sx={{ p: 3, textAlign: "center" }}>
				<Typography>User not found.</Typography>
			</Box>
		);
	}

	const getFullUrl = (urlPath: string | undefined): string | undefined => {
		if (!urlPath) return undefined;
		const imageUrl = urlPath.startsWith("http")
			? urlPath
			: urlPath.startsWith("/")
				? `${BASE_URL}${urlPath}`
				: `${BASE_URL}/${urlPath}`;
		return imageUrl;
	};

	const fullAvatarUrl = getFullUrl(profileData?.avatar);
	const fullCoverUrl = getFullUrl(profileData?.cover);

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
					py: 0.5,
					display: "flex",
					alignItems: "center",
					gap: 3,
				}}
			>
				<IconButton onClick={() => navigate(-1)} size="small">
					<ArrowBackIcon />
				</IconButton>
				<Box>
					<Typography variant="h6" sx={{ lineHeight: 1.2 }}>
						{profileData.username}
					</Typography>
					<Typography variant="caption" color="text.secondary">
						{flattenedImages.length} posts
					</Typography>
				</Box>
			</Box>

			{/* Cover Photo */}
			<Box
				sx={{
					position: "relative",
					height: { xs: 150, sm: 200 },
					bgcolor: theme.palette.mode === "dark" ? "grey.800" : "grey.200",
					backgroundSize: "cover",
					backgroundPosition: "center",
					backgroundImage: fullCoverUrl ? `url(${fullCoverUrl})` : "none",
				}}
			>
				{/* Edit Cover Button */}
				{isProfileOwner && (
					<IconButton
						size="small"
						onClick={() => setIsCoverModalOpen(true)}
						sx={{
							position: "absolute",
							bottom: 16,
							right: 16,
							bgcolor: alpha(theme.palette.common.black, 0.5),
							color: theme.palette.common.white,
							"&:hover": {
								bgcolor: alpha(theme.palette.common.black, 0.7),
							},
						}}
					>
						<CameraAltIcon fontSize="small" />
					</IconButton>
				)}
			</Box>

			{/* Profile Info Section */}
			<Box sx={{ px: 2, pb: 2 }}>
				{/* Top Row: Avatar and Edit/Follow Button */}
				<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
					{/* Avatar Container */}
					<Box sx={{ mt: "-15%" }}>
						<Box sx={{ position: "relative", display: "inline-block" }}>
							<Avatar
								src={fullAvatarUrl}
								alt={`${profileData?.username}'s avatar`}
								sx={{
									width: { xs: 80, sm: 134 },
									height: { xs: 80, sm: 134 },
									border: `4px solid ${theme.palette.background.default}`,
								}}
							/>
							{isProfileOwner && (
								<IconButton
									size="small"
									onClick={() => setIsAvatarModalOpen(true)}
									sx={{
										position: "absolute",
										bottom: 0,
										right: 0,
										bgcolor: alpha(theme.palette.common.black, 0.5),
										color: theme.palette.common.white,
										"&:hover": { bgcolor: alpha(theme.palette.common.black, 0.7) },
									}}
								>
									<CameraAltIcon fontSize="small" />
								</IconButton>
							)}
						</Box>
					</Box>

					{/* Action Buttons */}
					<Box sx={{ mt: 1.5 }}>
						{isProfileOwner ? (
							<Button
								variant="outlined"
								onClick={() => setIsEditProfileOpen(true)}
								sx={{
									borderRadius: 9999,
									textTransform: "none",
									fontWeight: 700,
									borderColor: theme.palette.divider,
									color: theme.palette.text.primary,
									"&:hover": {
										bgcolor: alpha(theme.palette.text.primary, 0.1),
										borderColor: theme.palette.divider,
									},
								}}
							>
								Edit profile
							</Button>
						) : isLoggedIn ? (
							<Box sx={{ display: "flex", gap: 1 }}>
								<Tooltip title="Message">
									<IconButton
										onClick={handleMessageUser}
										sx={{
											border: `1px solid ${theme.palette.divider}`,
											color: theme.palette.text.primary,
										}}
									>
										<MailOutlineIcon />
									</IconButton>
								</Tooltip>
								<Button
									variant={isFollowing ? "outlined" : "contained"}
									onClick={handleFollowUser}
									disabled={isCheckingFollow || followPending}
									sx={{
										borderRadius: 9999,
										textTransform: "none",
										fontWeight: 700,
										minWidth: 100,
										bgcolor: isFollowing ? "transparent" : "common.white",
										color: isFollowing ? "text.primary" : "common.black",
										borderColor: isFollowing ? "divider" : "transparent",
										"&:hover": {
											bgcolor: isFollowing ? "rgba(244, 33, 46, 0.1)" : alpha(theme.palette.common.white, 0.9),
											color: isFollowing ? "error.main" : "common.black",
											borderColor: isFollowing ? "error.main" : "transparent",
										},
									}}
								>
									{isFollowing ? "Unfollow" : "Follow"}
								</Button>
							</Box>
						) : (
							<Button
								variant="contained"
								onClick={() => navigate("/login")}
								sx={{
									borderRadius: 9999,
									bgcolor: "common.white",
									color: "common.black",
									fontWeight: 700,
									"&:hover": { bgcolor: alpha(theme.palette.common.white, 0.9) },
								}}
							>
								Follow
							</Button>
						)}
					</Box>
				</Box>

				{/* Name and Handle */}
				<Box sx={{ mt: 1 }}>
					<Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
						{profileData.username}
					</Typography>
					<Typography variant="body2" color="text.secondary">
						@{profileData.username}
					</Typography>
				</Box>

				{/* Bio */}
				{profileData.bio && (
					<Typography variant="body1" sx={{ mt: 1.5, whiteSpace: "pre-wrap" }}>
						{profileData.bio}
					</Typography>
				)}

				{/* Metadata (Join Date, etc) */}
				<Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1.5, color: "text.secondary" }}>
					<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
						<CalendarMonthIcon fontSize="small" />
						<Typography variant="body2">
							Joined {profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : "Unknown"}
						</Typography>
					</Box>
				</Box>

				{/* Follow Counts */}
				<Box sx={{ display: "flex", gap: 2.5, mt: 1.5 }}>
					<Box sx={{ display: "flex", gap: 0.5, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
						<Typography variant="body2" fontWeight={700} color="text.primary">
							{profileData.followingCount || 0}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Following
						</Typography>
					</Box>
					<Box sx={{ display: "flex", gap: 0.5, cursor: "pointer", "&:hover": { textDecoration: "underline" } }}>
						<Typography variant="body2" fontWeight={700} color="text.primary">
							{profileData.followerCount || 0}
						</Typography>
						<Typography variant="body2" color="text.secondary">
							Followers
						</Typography>
					</Box>
				</Box>
			</Box>

			{/* Tabs Navigation */}
			<Box sx={{ borderBottom: 1, borderColor: "divider" }}>
				<Tabs
					value={activeTab}
					onChange={(_, newValue) => setActiveTab(newValue)}
					variant="fullWidth"
					textColor="inherit"
					indicatorColor="primary"
					sx={{
						"& .MuiTab-root": {
							textTransform: "none",
							fontWeight: 700,
							fontSize: "0.95rem",
							minHeight: 53,
							color: "text.secondary",
							"&:hover": {
								bgcolor: alpha(theme.palette.text.primary, 0.1),
							},
							"&.Mui-selected": {
								color: "text.primary",
							},
						},
						"& .MuiTabs-indicator": {
							height: 4,
							borderRadius: 2,
						},
					}}
				>
					<Tab label="Posts" />
					<Tab label="Replies" disabled />
					<Tab label="Media" disabled />
					<Tab label="Likes" disabled />
				</Tabs>
			</Box>

			{/* Feed Content */}
			<Box>
				{activeTab === 0 && (
					<>
						{flattenedImages.length === 0 && !isLoadingImages ? (
							<Box sx={{ p: 4, textAlign: "center" }}>
								<Typography variant="h6" fontWeight={700} gutterBottom>
									@{profileData.username} hasn't posted yet
								</Typography>
								<Typography variant="body2" color="text.secondary">
									When they do, their posts will show up here.
								</Typography>
							</Box>
						) : (
							<Gallery
								posts={flattenedImages}
								fetchNextPage={fetchNextPage}
								hasNextPage={!!hasNextPage}
								isFetchingNext={isFetchingNextPage}
								isLoadingAll={isLoadingAll}
							/>
						)}
					</>
				)}
			</Box>

			{/* Modals */}
			<Modal
				open={isAvatarModalOpen}
				onClose={() => setIsAvatarModalOpen(false)}
				sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}
			>
				<Paper sx={{ p: 3, borderRadius: 4, maxWidth: 500, width: "100%" }}>
					<Typography variant="h6" gutterBottom fontWeight={700}>
						Update Profile Picture
					</Typography>
					<ImageEditor type="avatar" onImageUpload={handleAvatarUpload} onClose={() => setIsAvatarModalOpen(false)} />
				</Paper>
			</Modal>

			<Modal
				open={isCoverModalOpen}
				onClose={() => setIsCoverModalOpen(false)}
				sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}
			>
				<Paper sx={{ p: 3, borderRadius: 4, maxWidth: 600, width: "100%" }}>
					<Typography variant="h6" gutterBottom fontWeight={700}>
						Update Cover Photo
					</Typography>
					<ImageEditor
						type="cover"
						aspectRatio={3}
						onImageUpload={handleCoverUpload}
						onClose={() => setIsCoverModalOpen(false)}
					/>
				</Paper>
			</Modal>

			<Modal
				open={isEditProfileOpen}
				onClose={() => setIsEditProfileOpen(false)}
				sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}
			>
				<Paper sx={{ p: 3, borderRadius: 4, maxWidth: 600, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
					<Typography variant="h6" gutterBottom fontWeight={700}>
						Edit Profile
					</Typography>
					<EditProfile
						onComplete={() => setIsEditProfileOpen(false)}
						notifySuccess={notifySuccess}
						notifyError={notifyError}
						initialData={profileData}
					/>
				</Paper>
			</Modal>

			<ToastContainer
				position="bottom-right"
				autoClose={3000}
				theme={theme.palette.mode === "dark" ? "dark" : "light"}
			/>
		</Box>
	);
};

export default Profile;
