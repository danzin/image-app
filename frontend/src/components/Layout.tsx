import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Box, useTheme, useMediaQuery, IconButton } from "@mui/material";
import { Menu as MenuIcon } from "@mui/icons-material";
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
				minHeight: "100vh",
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
				<Box
					sx={{
						position: "sticky",
						top: 0,
						height: "100vh",
						zIndex: 10,
					}}
				>
					<LeftSidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
				</Box>

				{/* --- Main Content Area --- */}
				<Box
					sx={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						borderLeft: `1px solid ${theme.palette.divider}`,
						borderRight: `1px solid ${theme.palette.divider}`,
					}}
				>
					{/* Scrollable Main Content */}
					<Box
						component="main"
						sx={{
							display: "flex",
							flexDirection: "column",
							py: 3,
						}}
					>
						{isMobile && (
							<IconButton
								color="inherit"
								aria-label="open drawer"
								edge="start"
								onClick={handleDrawerToggle}
								sx={{
									position: "fixed",
									left: 8,
									top: 8,
									zIndex: theme.zIndex.appBar + 1,
									bgcolor: "background.paper",
									"&:hover": {
										bgcolor: "background.default",
									},
								}}
							>
								<MenuIcon />
							</IconButton>
						)}
						<Outlet />
					</Box>
				</Box>

				{/* --- Right Sidebar --- */}
				<Box
					sx={{
						position: "sticky",
						top: 0,
						height: "100vh",
						zIndex: 10,
					}}
				>
					<RightSidebar />
				</Box>
			</Box>
		</Box>
	);
};

export default Layout;
