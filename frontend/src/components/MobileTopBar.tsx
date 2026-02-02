import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { Box, Avatar, TextField, InputAdornment, IconButton } from "@mui/material";
import { Search as SearchIcon, Bookmark as BookmarkIcon } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useAuth } from "../hooks/context/useAuth";

const TOUCH_THRESHOLD = 30;

const MobileTopBar: React.FC = () => {
	const theme = useTheme();
	const location = useLocation();
	const navigate = useNavigate();
	const { user } = useAuth();
	const [searchQuery, setSearchQuery] = useState("");
	const [isVisible, setIsVisible] = useState(true);
	const touchStartY = useRef(0);
	const isTouching = useRef(false);

	const handleTouchStart = useCallback((e: TouchEvent) => {
		touchStartY.current = e.touches[0].clientY;
		isTouching.current = true;
	}, []);

	const handleTouchMove = useCallback((e: TouchEvent) => {
		if (!isTouching.current) return;

		const currentY = e.touches[0].clientY;
		const deltaY = touchStartY.current - currentY;

		// swiping up (positive delta, finger moves up) - hide top bar
		if (deltaY > TOUCH_THRESHOLD) {
			setIsVisible(false);
			touchStartY.current = currentY;
		}
		// swiping down (negative delta, finger moves down) - show top bar
		else if (deltaY < -TOUCH_THRESHOLD) {
			setIsVisible(true);
			touchStartY.current = currentY;
		}
	}, []);

	const handleTouchEnd = useCallback(() => {
		isTouching.current = false;
	}, []);

	useEffect(() => {
		window.addEventListener("touchstart", handleTouchStart, { passive: true });
		window.addEventListener("touchmove", handleTouchMove, { passive: true });
		window.addEventListener("touchend", handleTouchEnd, { passive: true });

		return () => {
			window.removeEventListener("touchstart", handleTouchStart);
			window.removeEventListener("touchmove", handleTouchMove);
			window.removeEventListener("touchend", handleTouchEnd);
		};
	}, [handleTouchStart, handleTouchMove, handleTouchEnd]);

	// reset visibility when navigating
	useEffect(() => {
		setIsVisible(true);
	}, [location.pathname]);

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (searchQuery.trim()) {
			navigate(`/results?q=${encodeURIComponent(searchQuery.trim())}`);
			setSearchQuery("");
		}
	};

	const BASE_URL = "/api";
	const avatarUrl = user?.avatar || "";
	const fullAvatarUrl = avatarUrl.startsWith("http")
		? avatarUrl
		: avatarUrl.startsWith("/")
			? `${BASE_URL}${avatarUrl}`
			: avatarUrl
				? `${BASE_URL}/${avatarUrl}`
				: undefined;

	return (
		<Box
			sx={{
				position: "sticky",
				top: 0,
				zIndex: 1100,
				bgcolor: "rgba(0, 0, 0, 0.65)",
				backdropFilter: "blur(12px)",
				borderBottom: `1px solid ${theme.palette.divider}`,
				height: 53,
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				px: 2,
				gap: 1.5,
				transform: isVisible ? "translateY(0)" : "translateY(-100%)",
				transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
				willChange: "transform",
			}}
		>
			<Avatar
				component={RouterLink}
				to={user ? `/profile/${user.handle}` : "/login"}
				src={fullAvatarUrl}
				sx={{ width: 32, height: 32, cursor: "pointer", flexShrink: 0 }}
			>
				{user?.username?.charAt(0).toUpperCase()}
			</Avatar>

			<Box component="form" onSubmit={handleSearch} sx={{ flex: 1, display: "flex", alignItems: "center" }}>
				<TextField
					size="small"
					placeholder="Search..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					fullWidth
					InputProps={{
						startAdornment: (
							<InputAdornment position="start">
								<SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
							</InputAdornment>
						),
						sx: {
							borderRadius: 3,
							bgcolor: "rgba(255, 255, 255, 0.08)",
							"& fieldset": { border: "none" },
							height: 36,
							fontSize: "0.875rem",
						},
					}}
				/>
			</Box>

			<IconButton component={RouterLink} to="/favorites" sx={{ color: "text.primary" }}>
				<BookmarkIcon />
			</IconButton>
		</Box>
	);
};

export default MobileTopBar;
