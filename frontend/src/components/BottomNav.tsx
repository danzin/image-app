import React from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Paper, BottomNavigation, BottomNavigationAction, Box, Badge } from "@mui/material";
import {
	Home as HomeIcon,
	Search as SearchIcon,
	Notifications as NotificationsIcon,
	MailOutline as MailIcon,
	AddBoxOutlined as AddBoxIcon,
	Groups as GroupsIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useNotifications } from "../hooks/notifications/useNotification";
import { useTranslation } from "react-i18next";

interface BottomNavProps {
	onPostClick: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ onPostClick }) => {
	const { t } = useTranslation();
	const { notifications } = useNotifications();
	const location = useLocation();
	const theme = useTheme();

	const unreadCount = notifications.filter((n) => !n.isRead).length;

	// Determine the current value based on the path
	const getValue = () => {
		const path = location.pathname;
		if (path === "/") return 0;
		if (path === "/discover") return 1;
		if (path === "/communities") return 2;
		// Index 3 is the Post button
		if (path === "/notifications") return 4;
		if (path === "/messages") return 5;
		return 0;
	};

	return (
		<Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 1000 }}>
			<Paper elevation={3}>
				<BottomNavigation
					showLabels={false}
					value={getValue()}
					sx={{
						bgcolor: "background.default",
						borderTop: `1px solid ${theme.palette.divider}`,
						height: 56,
					}}
				>
					<BottomNavigationAction
						component={RouterLink}
						to="/"
						label={t("nav.home")}
						icon={<HomeIcon />}
						sx={{
							color: "text.secondary",
							"&.Mui-selected": { color: "primary.main" },
						}}
					/>

					{/* Post Button */}
					<BottomNavigationAction
						label={t("nav.post")}
						icon={<AddBoxIcon sx={{ fontSize: 32 }} />}
						onClick={onPostClick}
						sx={{
							color: "text.primary",
							"&.Mui-selected": { color: "primary.main" },
						}}
					/>

					<BottomNavigationAction
						component={RouterLink}
						to="/discover"
						label={t("nav.explore")}
						icon={<SearchIcon />}
						sx={{
							color: "text.secondary",
							"&.Mui-selected": { color: "primary.main" },
						}}
					/>
					<BottomNavigationAction
						component={RouterLink}
						to="/communities"
						label={t("nav.communities")}
						icon={<GroupsIcon />}
						sx={{
							color: "text.secondary",
							"&.Mui-selected": { color: "primary.main" },
						}}
					/>

					<BottomNavigationAction
						component={RouterLink}
						to="/notifications"
						label={t("nav.notifications")}
						icon={
							<Badge badgeContent={unreadCount} color="primary">
								<NotificationsIcon />
							</Badge>
						}
						sx={{
							color: "text.secondary",
							"&.Mui-selected": { color: "primary.main" },
						}}
					/>
					<BottomNavigationAction
						component={RouterLink}
						to="/messages"
						label={t("nav.messages")}
						icon={<MailIcon />}
						sx={{
							color: "text.secondary",
							"&.Mui-selected": { color: "primary.main" },
						}}
					/>
				</BottomNavigation>
			</Paper>
		</Box>
	);
};

export default BottomNav;
