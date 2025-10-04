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
	Modal,
	Typography,
	Drawer,
	useTheme,
	useMediaQuery,
	alpha,
} from "@mui/material";
import {
	Home as HomeIcon,
	Person as PersonIcon,
	Add as AddIcon,
	CameraAlt as CameraAltIcon,
	Explore as ExploreIcon,
	Bookmark as BookmarkIcon,
	ChatBubbleOutline as ChatBubbleOutlineIcon,
} from "@mui/icons-material";
import { useAuth } from "../hooks/context/useAuth";
import UploadForm from "./UploadForm";

const SIDEBAR_WIDTH = 240;
const BASE_URL = "/api";
const modalStyle = {
	position: "absolute",
	top: "50%",
	left: "50%",
	transform: "translate(-50%, -50%)",
	width: 400,
	bgcolor: "background.paper",
	boxShadow: 24,
	p: 4,
	borderRadius: 2,
};

interface NavigationItem {
	label: string;
	icon: React.ReactNode;
	path?: string;
	onClick?: () => void;
	hideOnMobile?: boolean;
}

interface LeftSidebarProps {
	mobileOpen?: boolean;
	onMobileClose?: () => void;
}

const LeftSidebar: React.FC<LeftSidebarProps> = ({ mobileOpen = false, onMobileClose }) => {
	const { isLoggedIn, logout, user } = useAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("md"));
	const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

	const handleLogout = () => {
		logout();
		navigate("/");
		if (onMobileClose) onMobileClose();
	};

	const openUploadModal = () => {
		setIsUploadModalOpen(true);
		if (onMobileClose) onMobileClose();
	};

	const closeUploadModal = () => setIsUploadModalOpen(false);

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

	const navigationItems: NavigationItem[] = [
		{
			label: "Home",
			icon: <HomeIcon />,
			path: "/",
		},
		{
			label: "Discover",
			icon: <ExploreIcon />,
			path: "/discover",
		},
		{
			label: "Profile",
			icon: user ? (
				<Avatar src={fullAvatarUrl} sx={{ width: 24, height: 24 }}>
					{user.username?.charAt(0).toUpperCase()}
				</Avatar>
			) : (
				<PersonIcon />
			),
			path: user?.publicId ? `/profile/${user.publicId}` : "/profile",
		},
		{
			label: "Favorites",
			icon: <BookmarkIcon />,
			path: "/favorites",
		},
		{
			label: "Messages",
			icon: <ChatBubbleOutlineIcon />,
			path: "/messages",
		},
	];

	const sidebarContent = (
		<Box
			sx={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
			}}
		>
			{/* Logo Section */}
			<Box
				sx={{
					p: 3,
					display: "flex",
					alignItems: "center",
					borderBottom: "1px solid rgba(99, 102, 241, 0.1)",
				}}
			>
				<Avatar
					component={RouterLink}
					to="/"
					sx={{
						background: "linear-gradient(45deg, #6366f1, #ec4899)",
						mr: 2,
						width: 40,
						height: 40,
						cursor: "pointer",
						"&:hover": {
							transform: "scale(1.05)",
						},
						transition: "transform 0.2s ease",
					}}
				>
					<CameraAltIcon sx={{ fontSize: 20 }} />
				</Avatar>
				{!isMobile && (
					<Typography
						variant="h5"
						component={RouterLink}
						to="/"
						sx={{
							color: "transparent",
							backgroundImage: "linear-gradient(45deg, #6366f1, #ec4899)",
							backgroundClip: "text",
							WebkitBackgroundClip: "text",
							fontWeight: 700,
							textDecoration: "none",
							"&:hover": {
								opacity: 0.8,
							},
						}}
					>
						Peek
					</Typography>
				)}
			</Box>

			{/* Navigation Section */}
			<Box sx={{ flex: 1, py: 2 }}>
				{isLoggedIn ? (
					<List sx={{ px: 2 }}>
						{navigationItems.map((item) => (
							<ListItem key={item.label} disablePadding sx={{ mb: 1 }}>
								<ListItemButton
									component={item.path ? RouterLink : "button"}
									to={item.path}
									onClick={() => {
										if (item.onClick) item.onClick();
										if (isMobile && onMobileClose) onMobileClose();
									}}
									selected={isRouteActive(item.path)}
									sx={{
										borderRadius: 2,
										minHeight: 56,
										"&.Mui-selected": {
											backgroundColor: alpha(theme.palette.primary.main, 0.15),
											"&:hover": {
												backgroundColor: alpha(theme.palette.primary.main, 0.2),
											},
										},
										"&:hover": {
											backgroundColor: alpha(theme.palette.common.white, 0.05),
										},
									}}
								>
									<ListItemIcon
										sx={{
											color: isRouteActive(item.path) ? theme.palette.primary.main : theme.palette.text.secondary,
											minWidth: 40,
										}}
									>
										{item.icon}
									</ListItemIcon>
									<ListItemText
										primary={item.label}
										sx={{
											"& .MuiListItemText-primary": {
												fontWeight: isRouteActive(item.path) ? 600 : 400,
												color: isRouteActive(item.path) ? theme.palette.primary.main : theme.palette.text.primary,
											},
										}}
									/>
								</ListItemButton>
							</ListItem>
						))}

						{/* Upload/Post Button */}
						<ListItem sx={{ px: 0, mt: 3 }}>
							<ListItemButton
								onClick={openUploadModal}
								data-testid="post-button"
								sx={{
									backgroundColor: alpha(theme.palette.primary.main, 0.9),
									borderRadius: 3,
									minHeight: 56,
									mx: 2,
									"&:hover": {
										backgroundColor: theme.palette.primary.main,
									},
									background: "linear-gradient(45deg, #6366f1, #8b5cf6)",
								}}
							>
								<ListItemIcon sx={{ color: "white", minWidth: 40 }}>
									<AddIcon />
								</ListItemIcon>
								<ListItemText
									primary="Post"
									sx={{
										"& .MuiListItemText-primary": {
											color: "white",
											fontWeight: 600,
										},
									}}
								/>
							</ListItemButton>
						</ListItem>
					</List>
				) : (
					<Box sx={{ p: 3, textAlign: "center" }}>
						<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
							Sign in to access all features
						</Typography>
					</Box>
				)}
			</Box>

			{/* User Section - Bottom */}
			{isLoggedIn && user && (
				<Box
					sx={{
						p: 2,
						borderTop: "1px solid rgba(99, 102, 241, 0.1)",
					}}
				>
					<ListItemButton
						onClick={handleLogout}
						sx={{
							borderRadius: 2,
							minHeight: 48,
							"&:hover": {
								backgroundColor: alpha(theme.palette.error.main, 0.1),
							},
						}}
					>
						<ListItemIcon sx={{ minWidth: 40 }}>
							<Avatar src={fullAvatarUrl} sx={{ width: 24, height: 24 }}>
								{user.username?.charAt(0).toUpperCase()}
							</Avatar>
						</ListItemIcon>
						<ListItemText
							primary="Logout"
							secondary={`@${user.username}`}
							sx={{
								"& .MuiListItemText-primary": {
									fontSize: "0.875rem",
								},
								"& .MuiListItemText-secondary": {
									fontSize: "0.75rem",
								},
							}}
						/>
					</ListItemButton>
				</Box>
			)}

			{/* Upload Modal */}
			<Modal
				open={isUploadModalOpen}
				onClose={closeUploadModal}
				aria-labelledby="upload-modal-title"
				aria-describedby="upload-modal-description"
			>
				<Box sx={modalStyle}>
					<Typography id="upload-modal-title" variant="h6" component="h2" sx={{ mb: 2 }}>
						Upload Image
					</Typography>
					<UploadForm onClose={closeUploadModal} />
				</Box>
			</Modal>
		</Box>
	);

	if (isMobile) {
		return (
			<Drawer
				variant="temporary"
				open={mobileOpen}
				onClose={onMobileClose}
				ModalProps={{
					keepMounted: true, // Better open performance on mobile
				}}
				sx={{
					display: { xs: "block", md: "none" },
					"& .MuiDrawer-paper": {
						boxSizing: "border-box",
						width: SIDEBAR_WIDTH,
					},
				}}
			>
				{sidebarContent}
			</Drawer>
		);
	}

	return (
		<Drawer
			variant="permanent"
			data-testid="left-sidebar"
			sx={{
				display: { xs: "none", md: "block" },
				"& .MuiDrawer-paper": {
					boxSizing: "border-box",
					width: SIDEBAR_WIDTH,
					position: "relative",
				},
			}}
		>
			{sidebarContent}
		</Drawer>
	);
};

export default LeftSidebar;
