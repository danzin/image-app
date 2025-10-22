import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Box, useTheme, useMediaQuery, IconButton } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import Navbar from "./Navbar";
import LeftSidebar from "./LeftSidebar";
import RightSidebar from "./RightSidebar";

const Layout: React.FC = () => {
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [mobileOpen, setMobileOpen] = useState(false);

	const handleDrawerToggle = () => {
		setMobileOpen(!mobileOpen);
	};

	return (
		<Box
			sx={{
				height: "100vh",
				display: "flex",
				bgcolor: "background.default",
			}}
		>
			<Box
				sx={{
					display: "flex",
					width: "100%",
					maxWidth: "1650px",
					ml: 1,
				}}
			>
				{/* --- Left Sidebar --- */}
				<LeftSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

				{/* --- Main Content Area --- */}
				<Box
					sx={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						overflow: "hidden",
						borderLeft: `1px solid ${theme.palette.divider}`,
						borderRight: `1px solid ${theme.palette.divider}`,
					}}
				>
					{/* Top Navbar Area */}
					<Box sx={{ position: "relative" }}>
						{isMobile && (
							<IconButton
								color="inherit"
								aria-label="open drawer"
								edge="start"
								onClick={handleDrawerToggle}
								sx={{
									position: "absolute",
									left: 8,
									top: "50%",
									transform: "translateY(-50%)",
									zIndex: theme.zIndex.appBar + 1,
								}}
							>
								<MenuIcon />
							</IconButton>
						)}
						<Navbar />
					</Box>

					{/* Scrollable Main Content */}
					<Box
						component="main"
						sx={{
							flex: 1,
							overflowY: "auto",
							display: "flex",
							flexDirection: "column",
						}}
					>
						<Outlet />
					</Box>
				</Box>

				{/* --- Right Sidebar --- */}
				<RightSidebar />
			</Box>
		</Box>
	);
};

export default Layout;
