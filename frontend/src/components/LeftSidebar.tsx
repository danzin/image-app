import React, { useState } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import {
	Box,
	List,
	ListItem,
	ListItemButton,
	ListItemIcon,
	ListItemText,
	Avatar,
	Typography,
	useTheme,
	alpha,
	Button,
	Badge,
	Menu,
	MenuItem,
	IconButton,
} from "@mui/material";
import {
	Home as HomeIcon,
	Person as PersonIcon,
	Add as AddIcon,
	CameraAlt as CameraAltIcon,
	Explore as ExploreIcon,
	Bookmark as BookmarkIcon,
	ChatBubbleOutline as ChatBubbleOutlineIcon,
	AdminPanelSettings as AdminPanelSettingsIcon,
	Notifications as NotificationsIcon,
	MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material";
import { useAuth } from "../hooks/context/useAuth";
import { useNotifications } from "../hooks/notifications/useNotification";

const BASE_URL = "/api";

interface NavigationItem {
	label: string;
	icon: React.ReactNode;
	path?: string;
	onClick?: () => void;
}

interface LeftSidebarProps {
	onPostClick: () => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ onPostClick }) => {
	const { isLoggedIn, logout, user } = useAuth();
	const { notifications } = useNotifications();
	const location = useLocation();
	const navigate = useNavigate();
	const theme = useTheme();

	const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
	const open = Boolean(anchorEl);

	const unreadCount = notifications.filter((n) => !n.isRead).length;

	const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
		event.preventDefault();
		event.stopPropagation();
		setAnchorEl(event.currentTarget);
	};

	const handleClose = () => {
		setAnchorEl(null);
	};

	const handleLogout = () => {
		handleClose();
		logout();
		navigate("/");
	};

	// Handle undefined avatar safely
	const avatarUrl = user?.avatar || "";
	const fullAvatarUrl = avatarUrl.startsWith("http")
		? avatarUrl
		: avatarUrl.startsWith("/")
			? `${BASE_URL}${avatarUrl}`
			: avatarUrl
				? `${BASE_URL}/${avatarUrl}`
				: undefined;

	const isRouteActive = (targetPath?: string) => {
		if (!targetPath) return false;
		if (targetPath === "/") return location.pathname === "/";
		return location.pathname === targetPath || location.pathname.startsWith(`${targetPath}/`);
	};

	const isAdmin = user && "isAdmin" in user && user.isAdmin === true;

	const navigationItems: NavigationItem[] = [
		{
			label: "Home",
			icon: <HomeIcon sx={{ fontSize: 28 }} />,
			path: "/",
		},
		{
			label: "Discover",
			icon: <ExploreIcon sx={{ fontSize: 28 }} />,
			path: "/discover",
		},
		{
			label: "Notifications",
			icon: (
				<Badge
					badgeContent={unreadCount}
					color="primary"
					sx={{
						"& .MuiBadge-badge": {
							right: 2,
							top: 2,
						},
					}}
				>
					<NotificationsIcon sx={{ fontSize: 28 }} />
				</Badge>
			),
			path: "/notifications",
		},
		{
			label: "Profile",
			icon: user ? (
				<Avatar src={fullAvatarUrl} sx={{ width: 28, height: 28 }}>
					{user.username?.charAt(0).toUpperCase()}
				</Avatar>
			) : (
				<PersonIcon sx={{ fontSize: 28 }} />
			),
			path: user?.publicId ? `/profile/${user.publicId}` : "/profile",
		},
		{
			label: "Favorites",
			icon: <BookmarkIcon sx={{ fontSize: 28 }} />,
			path: "/favorites",
		},
		{
			label: "Messages",
			icon: <ChatBubbleOutlineIcon sx={{ fontSize: 28 }} />,
			path: "/messages",
		},
	];

	if (isAdmin) {
		navigationItems.push({
			label: "Admin",
			icon: <AdminPanelSettingsIcon sx={{ fontSize: 28 }} />,
			path: "/admin",
		});
	}

	return (
		<Box
			sx={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				px: 2,
			}}
		>
			{/* Logo Section */}
			<Box
				sx={{
					py: 2,
					px: 1,
					display: "flex",
					alignItems: "center",
				}}
			>
				<Avatar
					component={RouterLink}
					to="/"
					sx={{
						bgcolor: "transparent",
						width: 50,
						height: 50,
						cursor: "pointer",
						"&:hover": {
							bgcolor: alpha(theme.palette.primary.main, 0.1),
						},
						transition: "background-color 0.2s ease",
					}}
				>
					<CameraAltIcon sx={{ fontSize: 30, color: theme.palette.primary.main }} />
				</Avatar>
			</Box>

			{/* Navigation Section */}
			<Box sx={{ flex: 1 }}>
				{isLoggedIn ? (
					<List>
						{navigationItems.map((item) => (
							<ListItem key={item.label} disablePadding sx={{ mb: 1 }}>
								<ListItemButton
									component={item.path ? RouterLink : "button"}
									to={item.path}
									onClick={item.onClick}
									sx={{
										borderRadius: 9999,
										py: 1.5,
										px: 2,
										"&:hover": {
											backgroundColor: alpha(theme.palette.text.primary, 0.1),
										},
									}}
								>
									<ListItemIcon
										sx={{
											color: isRouteActive(item.path) ? theme.palette.primary.main : theme.palette.text.primary,
											minWidth: 0,
											mr: 2,
										}}
									>
										{item.icon}
									</ListItemIcon>
									<ListItemText
										primary={item.label}
										sx={{
											display: { xs: "none", lg: "block" },
											"& .MuiListItemText-primary": {
												fontWeight: isRouteActive(item.path) ? 700 : 400,
												fontSize: "1.25rem",
												color: theme.palette.text.primary,
											},
										}}
									/>
								</ListItemButton>
							</ListItem>
						))}

						{/* Post Button */}
						<ListItem sx={{ px: 0, mt: 2 }}>
							<Button
								onClick={onPostClick}
								variant="contained"
								fullWidth
								sx={{
									borderRadius: 9999,
									py: 1.5,
									fontSize: "1.1rem",
									fontWeight: 700,
									textTransform: "none",
									boxShadow: "none",
									border: `1px solid ${theme.palette.primary.main}`,
									background: "transparent",
									display: { xs: "none", lg: "flex" },
								}}
							>
								Post
							</Button>
							<Button
								onClick={onPostClick}
								variant="contained"
								sx={{
									borderRadius: "50%",
									minWidth: 50,
									width: 50,
									height: 50,
									p: 0,
									boxShadow: "none",
									display: { xs: "flex", lg: "none" },
									justifyContent: "center",
									alignItems: "center",
								}}
							>
								<AddIcon />
							</Button>
						</ListItem>
					</List>
				) : (
					<Box
						sx={{
							p: 3,
							textAlign: "center",
							display: "flex",
							flexDirection: "column",
							gap: 2,
						}}
					>
						<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
							Sign in to access all features
						</Typography>
						<Button component={RouterLink} to="/login" variant="outlined" fullWidth sx={{ borderRadius: 9999 }}>
							Log In
						</Button>
						<Button component={RouterLink} to="/register" variant="contained" fullWidth sx={{ borderRadius: 9999 }}>
							Join
						</Button>
					</Box>
				)}
			</Box>

			{isLoggedIn && user && (
				<Box sx={{ py: 3 }}>
					<ListItemButton
						component={RouterLink}
						to={`/profile/${user.publicId}`}
						sx={{
							borderRadius: 9999,
							p: 1.5,
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							"&:hover": {
								backgroundColor: alpha(theme.palette.text.primary, 0.1),
							},
						}}
					>
						<Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
							<ListItemIcon sx={{ minWidth: 0, mr: { xs: 0, lg: 1.5 } }}>
								<Avatar src={fullAvatarUrl} sx={{ width: 40, height: 40 }}>
									{user.username?.charAt(0).toUpperCase()}
								</Avatar>
							</ListItemIcon>
							<Box
								sx={{
									display: { xs: "none", lg: "block" },
									overflow: "hidden",
								}}
							>
								<Typography variant="subtitle1" fontWeight={700} noWrap>
									{user.username}
								</Typography>
								<Typography variant="body2" color="text.secondary" noWrap>
									@{user.username}
								</Typography>
							</Box>
						</Box>

						<Box sx={{ display: { xs: "none", lg: "block" } }}>
							<IconButton
								size="small"
								onClick={handleMenuClick}
								sx={{
									color: theme.palette.text.primary,
									"&:hover": {
										backgroundColor: alpha(theme.palette.primary.main, 0.1),
									},
								}}
							>
								<MoreHorizIcon />
							</IconButton>
						</Box>
					</ListItemButton>

					<Menu
						anchorEl={anchorEl}
						open={open}
						onClose={handleClose}
						PaperProps={{
							sx: {
								borderRadius: 3,
								boxShadow: theme.shadows[3],
								minWidth: 180,
							},
						}}
						transformOrigin={{ horizontal: "center", vertical: "bottom" }}
						anchorOrigin={{ horizontal: "center", vertical: "top" }}
					>
						<MenuItem onClick={handleLogout} sx={{ py: 1.5, fontWeight: 700 }}>
							Log out @{user.username}
						</MenuItem>
					</Menu>
				</Box>
			)}
		</Box>
	);
};

export default LeftSidebar;
