import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { Paper, BottomNavigation, BottomNavigationAction, Box, Badge } from "@mui/material";
import {
	Home as HomeIcon,
	Search as SearchIcon,
	Notifications as NotificationsIcon,
	MailOutline as MailIcon,
	Groups as GroupsIcon,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useNotifications } from "../hooks/notifications/useNotification";
import { useTranslation } from "react-i18next";

const SCROLL_THRESHOLD = 15; // minimum scroll distance to trigger hide/show
const SCROLL_UP_MULTIPLIER = 0.5; // show nav faster when scrolling up

const BottomNav: React.FC = () => {
	const { t } = useTranslation();
	const { notifications } = useNotifications();
	const location = useLocation();
	const theme = useTheme();
	const [isVisible, setIsVisible] = useState(true);
	const lastScrollY = useRef(0);
	const accumulatedDelta = useRef(0);

	const unreadCount = notifications.filter((n) => !n.isRead).length;

	// pages where we should NOT hide the nav (e.g., messages needs the input visible)
	const isMessagesPage = location.pathname.startsWith("/messages");
	const isNotificationsPage = location.pathname.startsWith("/notifications");
	const shouldDisableHiding = isMessagesPage || isNotificationsPage;

	const handleScroll = useCallback(() => {
		if (shouldDisableHiding) return;

		const currentScrollY = window.scrollY;
		const delta = currentScrollY - lastScrollY.current;

		// at the very top, always show
		if (currentScrollY <= 50) {
			setIsVisible(true);
			accumulatedDelta.current = 0;
			lastScrollY.current = currentScrollY;
			return;
		}

		// accumulate scroll delta for smoother detection
		accumulatedDelta.current += delta;

		// scrolling down - need more accumulated scroll to hide
		if (accumulatedDelta.current > SCROLL_THRESHOLD) {
			setIsVisible(false);
			accumulatedDelta.current = 0;
		}
		// scrolling up - show faster (lower threshold)
		else if (accumulatedDelta.current < -SCROLL_THRESHOLD * SCROLL_UP_MULTIPLIER) {
			setIsVisible(true);
			accumulatedDelta.current = 0;
		}

		lastScrollY.current = currentScrollY;
	}, [shouldDisableHiding]);

	useEffect(() => {
		if (shouldDisableHiding) {
			setIsVisible(true);
			return;
		}

		let rafId: number;
		let lastTime = 0;
		const throttleMs = 16; // ~60fps

		const throttledScroll = () => {
			const now = Date.now();
			if (now - lastTime >= throttleMs) {
				lastTime = now;
				handleScroll();
			}
			rafId = requestAnimationFrame(throttledScroll);
		};

		const onScroll = () => {
			if (!rafId) {
				rafId = requestAnimationFrame(throttledScroll);
			}
		};

		window.addEventListener("scroll", onScroll, { passive: true });

		return () => {
			window.removeEventListener("scroll", onScroll);
			if (rafId) cancelAnimationFrame(rafId);
		};
	}, [shouldDisableHiding, handleScroll]);

	// reset visibility when navigating to a new page
	useEffect(() => {
		setIsVisible(true);
		lastScrollY.current = 0;
		accumulatedDelta.current = 0;
	}, [location.pathname]);

	// Determine the current value based on the path
	const getValue = () => {
		const path = location.pathname;
		if (path === "/") return 0;
		if (path === "/discover") return 1;
		if (path === "/communities") return 2;
		if (path === "/notifications") return 3;
		if (path === "/messages") return 4;
		return 0;
	};

	return (
		<Box
			sx={{
				position: "fixed",
				bottom: 0,
				left: 0,
				right: 0,
				zIndex: 1000,
				transform: isVisible ? "translateY(0)" : "translateY(100%)",
				transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
				willChange: "transform",
				backfaceVisibility: "hidden",
			}}
		>
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
