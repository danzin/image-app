import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Box, useTheme, useMediaQuery, Fab } from "@mui/material";
import { Add as AddIcon } from "@mui/icons-material";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import BottomNav from "./BottomNav";
import MobileTopBar from "./MobileTopBar";
import UploadForm from "./UploadForm";
import { useAuth } from "../hooks/context/useAuth";
import VerifyEmail from "../screens/VerifyEmail";
import { BottomNavProvider } from "../context/BottomNav/BottomNavContext";

const Layout: React.FC = () => {
	const theme = useTheme();
	const location = useLocation();
	const navigate = useNavigate();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
	const { user } = useAuth();
	const isEmailVerified = user ? !("isEmailVerified" in user) || user.isEmailVerified !== false : true;
	const shouldLockToVerification = !!user && !isEmailVerified;

	const isMessagesPage = location.pathname.startsWith("/messages");
	const isAdminPage = location.pathname.startsWith("/admin");
	const isNotificationsPage = location.pathname.startsWith("/notifications");

	// determine if we should show mobile top bar (only on home and explore)
	const showMobileTopBar = location.pathname === "/" || location.pathname.startsWith("/discover");
	// determine if we should show the FAB post button (hide on messages and notifications)
	const showMobileFab = !isMessagesPage && !isNotificationsPage;

	const handleOpenUploadModal = () => {
		if (!user) {
			navigate("/login");
			return;
		}
		setIsUploadModalOpen(true);
	};
	const handleCloseUploadModal = () => setIsUploadModalOpen(false);

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

	const content = (
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
					{isMobile && showMobileTopBar && <MobileTopBar />}

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

	// wrap with BottomNavProvider on mobile to share visibility state
	return isMobile ? <BottomNavProvider>{content}</BottomNavProvider> : content;
};

export default Layout;
