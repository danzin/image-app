import React, { useState } from "react";
import { Outlet, Link as RouterLink, useLocation } from "react-router-dom";
import { Box, useTheme, useMediaQuery, Avatar } from "@mui/material";
import { CameraAlt as CameraAltIcon } from "@mui/icons-material";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import BottomNav from "./BottomNav";
import UploadForm from "./UploadForm";
import { useAuth } from "../hooks/context/useAuth";

const Layout: React.FC = () => {
	const theme = useTheme();
	const location = useLocation();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
	const { user } = useAuth();

	const isMessagesPage = location.pathname.startsWith("/messages");
	const isAdminPage = location.pathname.startsWith("/admin");

	const handleOpenUploadModal = () => setIsUploadModalOpen(true);
	const handleCloseUploadModal = () => setIsUploadModalOpen(false);

	const BASE_URL = "/api";
	const avatarUrl = user?.avatar || "";
	const fullAvatarUrl = avatarUrl.startsWith("http")
		? avatarUrl
		: avatarUrl.startsWith("/")
			? `${BASE_URL}${avatarUrl}`
			: avatarUrl
				? `${BASE_URL}/${avatarUrl}`
				: undefined;

	return (
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				bgcolor: "background.default",
				justifyContent: "center", // Center the content on large screens
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
						maxWidth: isMessagesPage || isAdminPage ? "100%" : 600, // Allow full width for messages and admin
						width: "100%",
					}}
				>
					{/* Mobile Top Bar */}
					{isMobile && (
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
							}}
						>
							<Avatar
								component={RouterLink}
								to={user ? `/profile/${user.publicId}` : "/login"}
								src={fullAvatarUrl}
								sx={{ width: 32, height: 32, cursor: "pointer" }}
							>
								{user?.username?.charAt(0).toUpperCase()}
							</Avatar>
							<CameraAltIcon sx={{ color: theme.palette.primary.main }} />
							<Box sx={{ width: 32 }} /> {/* Spacer for centering logo */}
						</Box>
					)}

					<Outlet />

					{/* Bottom Padding for Mobile Nav */}
					{isMobile && <Box sx={{ height: 80 }} />}
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
			{isMobile && <BottomNav onPostClick={handleOpenUploadModal} />}

			{/* Upload Modal */}
			{isUploadModalOpen && <UploadForm onClose={handleCloseUploadModal} />}
		</Box>
	);
};

export default Layout;
