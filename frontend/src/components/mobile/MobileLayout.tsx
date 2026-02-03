import React, { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Box } from "@mui/material";
import MobileHeader from "./MobileHeader";
import MobileDrawer from "./MobileDrawer";
import MobileFAB from "./MobileFAB";
import UploadForm from "../UploadForm";
import { useSwipeDrawer } from "../../hooks/useSwipeDrawer";
import { useAuth } from "../../hooks/context/useAuth";
import VerifyEmail from "../../screens/VerifyEmail";

const MobileLayout: React.FC = () => {
	const location = useLocation();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

	const {
		isOpen: isDrawerOpen,
		close: closeDrawer,
		toggle: toggleDrawer,
		drawerRef,
		backdropRef,
		dragOffset,
		isDragging,
	} = useSwipeDrawer();

	const isEmailVerified = user ? !("isEmailVerified" in user) || user.isEmailVerified !== false : true;
	const shouldLockToVerification = !!user && !isEmailVerified;

	// pages where FAB should be hidden
	const isMessagesPage = location.pathname.startsWith("/messages");
	const isNotificationsPage = location.pathname.startsWith("/notifications");
	const showFAB = !isMessagesPage && !isNotificationsPage;

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
					minHeight: "100dvh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					bgcolor: "background.default",
					"@supports not (min-height: 100dvh)": {
						minHeight: "100vh",
					},
				}}
			>
				<VerifyEmail />
			</Box>
		);
	}

	return (
		<Box
			sx={{
				minHeight: "100dvh",
				height: "100dvh",
				display: "flex",
				flexDirection: "column",
				bgcolor: "background.default",
				// prevent horizontal overflow from drawer animations
				overflowX: "hidden",
				"@supports not (min-height: 100dvh)": {
					minHeight: "100vh",
					height: "100vh",
				},
			}}
		>
			{/* persistent header */}
			<MobileHeader onMenuClick={toggleDrawer} />

			{/* swipeable drawer */}
			<MobileDrawer
				isOpen={isDrawerOpen}
				onClose={closeDrawer}
				drawerRef={drawerRef}
				backdropRef={backdropRef}
				dragOffset={dragOffset}
				isDragging={isDragging}
			/>

			{/* main content area */}
			<Box
				component="main"
				sx={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					minWidth: 0,
					minHeight: 0,
					// messages page handles its own scroll, others can overflow
					overflow: isMessagesPage ? "hidden" : "auto",
					// padding for FAB (only when not on messages page)
					pb: showFAB ? "80px" : "env(safe-area-inset-bottom)",
				}}
			>
				<Outlet />
			</Box>

			{/* persistent FAB */}
			{showFAB && <MobileFAB onClick={handleOpenUploadModal} />}

			{/* upload modal */}
			{isUploadModalOpen && <UploadForm onClose={handleCloseUploadModal} />}
		</Box>
	);
};

export default MobileLayout;
