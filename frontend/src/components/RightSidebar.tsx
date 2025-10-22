import React from "react";
import { Box, useTheme, useMediaQuery } from "@mui/material";
import WhoToFollow from "./WhoToFollow";
import { useAuth } from "../hooks/context/useAuth";

const RightSidebar: React.FC = () => {
	const theme = useTheme();
	const isLargeScreen = useMediaQuery(theme.breakpoints.up("lg"));
	const { isLoggedIn } = useAuth();

	if (!isLargeScreen || !isLoggedIn) {
		return null;
	}

	return (
		<Box
			component="aside"
			sx={{
				width: 320,
				flexShrink: 0,
				p: 3,
				overflowY: "auto",
				height: "100vh",
				position: "sticky",
				top: 0,
				bgcolor: "background.default",
			}}
		>
			<WhoToFollow limit={5} />
		</Box>
	);
};

export default RightSidebar;
