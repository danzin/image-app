import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";
import UploadForm from "./UploadForm";
import { MobileLayout } from "./mobile";
import { useAuth } from "../hooks/context/useAuth";
import VerifyEmail from "../screens/VerifyEmail";

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
	const isSettingsPage = location.pathname.startsWith("/settings");

	const handleOpenUploadModal = () => {
		if (!user) {
			navigate("/login");
			return;
		}
		setIsUploadModalOpen(true);
	};
	const handleCloseUploadModal = () => setIsUploadModalOpen(false);

	// use dedicated mobile layout for mobile devices
	if (isMobile) {
		return <MobileLayout />;
	}

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

	// desktop layout
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

				{/* --- Main Content Area --- */}
				<Box
					component="main"
					sx={{
						flexGrow: 1,
						flexShrink: 1,
						display: "flex",
						flexDirection: "column",
						minWidth: 0,
						borderRight: !isMessagesPage && !isAdminPage && !isSettingsPage ? `1px solid ${theme.palette.divider}` : "none",
						maxWidth: isMessagesPage || isAdminPage ? "100%" : isSettingsPage ? 900 : 600,
						width: "100%",
					}}
				>
					<Outlet />
				</Box>

				{/* --- Right Sidebar (Desktop) --- */}
				{!isMessagesPage && !isAdminPage && !isSettingsPage && (
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

			{/* Upload Modal */}
			{isUploadModalOpen && <UploadForm onClose={handleCloseUploadModal} />}
		</Box>
	);
};

export default Layout;
