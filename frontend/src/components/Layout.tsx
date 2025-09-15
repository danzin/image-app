import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Box, useTheme, useMediaQuery, IconButton } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
import Navbar from "./Navbar";
import LeftSidebar from "./LeftSidebar";

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
			{/* Left Sidebar */}
			<LeftSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

			{/* Main Content Area */}
			<Box
				sx={{
					flex: 1,
					display: "flex",
					flexDirection: "column",
					overflow: "hidden",
				}}
			>
				{/* Navbar with mobile menu button */}
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
								backgroundColor: "rgba(26, 26, 46, 0.8)",
								"&:hover": {
									backgroundColor: "rgba(26, 26, 46, 0.9)",
								},
							}}
						>
							<MenuIcon />
						</IconButton>
					)}
					<Navbar />
				</Box>

				{/* Main Content */}
				<Box
					component="main"
					sx={{
						flex: 1,
						overflowY: "auto",
						display: "flex",
						flexDirection: "column",
						width: "100%",
					}}
				>
					<Outlet />
				</Box>
			</Box>
		</Box>
	);
};

export default Layout;
