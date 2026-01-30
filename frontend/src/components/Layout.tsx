import React, { useState } from "react";
import { Outlet, Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Box, useTheme, useMediaQuery, Avatar, TextField, InputAdornment, Fab, IconButton } from "@mui/material";
import { Search as SearchIcon, Add as AddIcon, Bookmark as BookmarkIcon } from "@mui/icons-material";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import BottomNav from "./BottomNav";
import UploadForm from "./UploadForm";
import { useAuth } from "../hooks/context/useAuth";
import VerifyEmail from "../screens/VerifyEmail";

const Layout: React.FC = () => {
	const theme = useTheme();
	const location = useLocation();
	const navigate = useNavigate();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
	const [mobileSearchQuery, setMobileSearchQuery] = useState("");
	const { user } = useAuth();
	const isEmailVerified = user ? !("isEmailVerified" in user) || user.isEmailVerified !== false : true;
	const shouldLockToVerification = !!user && !isEmailVerified;

	const isMessagesPage = location.pathname.startsWith("/messages");
	const isAdminPage = location.pathname.startsWith("/admin");
	const isNotificationsPage = location.pathname.startsWith("/notifications");

	// determine if we should show mobile top bar (hide on messages and notifications)
	const showMobileTopBar = !isMessagesPage && !isNotificationsPage;
	// determine if we should show mobile search bar (only on home and explore)
	const showMobileSearchBar = location.pathname === "/" || location.pathname.startsWith("/discover");
	// determine if we should show the FAB post button (hide on messages and notifications)
	const showMobileFab = !isMessagesPage && !isNotificationsPage;

	const handleOpenUploadModal = () => setIsUploadModalOpen(true);
	const handleCloseUploadModal = () => setIsUploadModalOpen(false);

	const handleMobileSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (mobileSearchQuery.trim()) {
			navigate(`/results?q=${encodeURIComponent(mobileSearchQuery.trim())}`);
			setMobileSearchQuery("");
		}
	};

	const BASE_URL = "/api";
	const avatarUrl = user?.avatar || "";
	const fullAvatarUrl = avatarUrl.startsWith("http")
		? avatarUrl
		: avatarUrl.startsWith("/")
			? `${BASE_URL}${avatarUrl}`
			: avatarUrl
				? `${BASE_URL}/${avatarUrl}`
				: undefined;

	if (shouldLockToVerification) {
		return (
			<Box
				sx={{
					minHeight: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					bgcolor: "background.default",
				}}
			>
				<VerifyEmail />
			</Box>
		);
	}

	return (
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				bgcolor: "background.default",
				justifyContent: "center",
			}}
		>
			<Box
				sx={{
					display: "flex",
					width: "100%",
					maxWidth: "1280px",
				}}
			>
				{/* --- Left Sidebar --- */}
				{!isMobile && (
					<Box
						component="header"
						sx={{
							width: { md: 88, lg: 275 },
							flexShrink: 0,
							display: "flex",
							flexDirection: "column",
							alignItems: { md: "center", lg: "flex-start" },
						}}
					>
						<Box
							sx={{
								position: "fixed",
								height: "100vh",
								width: { md: 88, lg: 275 },
								zIndex: 10,
								borderRight: `1px solid ${theme.palette.divider}`,
							}}
						>
							<LeftSidebar onPostClick={handleOpenUploadModal} />
						</Box>
					</Box>
				)}

				{/* --- Main Content Area --- */}
				<Box
					component="main"
					sx={{
						flexGrow: 1,
						flexShrink: 1,
						display: "flex",
						flexDirection: "column",
						minWidth: 0,
						borderRight: !isMobile && !isMessagesPage && !isAdminPage ? `1px solid ${theme.palette.divider}` : "none",
						maxWidth: isMessagesPage || isAdminPage ? "100%" : 600,
						width: "100%",
					}}
				>
					{/* Mobile Top Bar */}
					{isMobile && showMobileTopBar && (
						<Box
							sx={{
								position: "sticky",
								top: 0,
								zIndex: 1100,
								bgcolor: "rgba(0, 0, 0, 0.65)",
								backdropFilter: "blur(12px)",
								borderBottom: `1px solid ${theme.palette.divider}`,
								height: 53,
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								px: 2,
								gap: 1.5,
							}}
						>
							<Avatar
								component={RouterLink}
								to={user ? `/profile/${user.publicId}` : "/login"}
								src={fullAvatarUrl}
								sx={{ width: 32, height: 32, cursor: "pointer", flexShrink: 0 }}
							>
								{user?.username?.charAt(0).toUpperCase()}
							</Avatar>
							{showMobileSearchBar && (
								<Box
									component="form"
									onSubmit={handleMobileSearch}
									sx={{ flex: 1, display: "flex", alignItems: "center" }}
								>
									<TextField
										size="small"
										placeholder="Search..."
										value={mobileSearchQuery}
										onChange={(e) => setMobileSearchQuery(e.target.value)}
										fullWidth
										InputProps={{
											startAdornment: (
												<InputAdornment position="start">
													<SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
												</InputAdornment>
											),
											sx: {
												borderRadius: 3,
												bgcolor: "rgba(255, 255, 255, 0.08)",
												"& fieldset": { border: "none" },
												height: 36,
												fontSize: "0.875rem",
											},
										}}
									/>
								</Box>
							)}
							<IconButton component={RouterLink} to="/favorites" sx={{ color: "text.primary" }}>
								<BookmarkIcon />
							</IconButton>
						</Box>
					)}

					<Outlet />

					{/* Bottom Padding for Mobile Nav - not needed for messages/notifications which manage their own layout */}
					{isMobile && !isMessagesPage && !isNotificationsPage && <Box sx={{ height: 80 }} />}
				</Box>

				{/* --- Right Sidebar (Desktop) --- */}
				{!isMobile && !isMessagesPage && !isAdminPage && (
					<Box
						sx={{
							marginLeft: 3,
							width: 350,
							flexShrink: 0,
							display: { xs: "none", md: "none", lg: "block" },
						}}
					>
						<Box
							sx={{
								position: "fixed",
								height: "100vh",
								width: 350,
								zIndex: 10,
								overflowY: "auto",
							}}
						>
							<RightSidebar />
						</Box>
					</Box>
				)}
			</Box>

			{/* Mobile Bottom Nav */}
			{isMobile && <BottomNav />}

			{/* Mobile FAB */}
			{isMobile && showMobileFab && (
				<Fab
					color="primary"
					aria-label="add"
					onClick={handleOpenUploadModal}
					sx={{
						position: "fixed",
						bottom: 70,
						right: 16,
						zIndex: 1000,
					}}
				>
					<AddIcon />
				</Fab>
			)}

			{/* Upload Modal */}
			{isUploadModalOpen && <UploadForm onClose={handleCloseUploadModal} />}
		</Box>
	);
};

export default Layout;
