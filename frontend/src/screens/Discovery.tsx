import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Box, Typography, Tabs, Tab, useTheme, Container, alpha } from "@mui/material";
import { TrendingUp, FiberNew, Favorite } from "@mui/icons-material";

import Gallery from "../components/Gallery";
import { useAuth } from "../hooks/context/useAuth";
import { useTrendingFeed, useNewFeed, useForYouFeed } from "../hooks/images/useImages";
import { getDefaultDiscoveryTab } from "../lib/userOnboarding";

interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
	return (
		<div
			role="tabpanel"
			hidden={value !== index}
			id={`discovery-tabpanel-${index}`}
			aria-labelledby={`discovery-tab-${index}`}
			{...other}
		>
			{value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
		</div>
	);
};

const Discovery: React.FC = () => {
	const theme = useTheme();
	const { user, isLoggedIn, loading: authLoading } = useAuth();

	// Start with "new" for new users, "for-you" for existing users
	const [activeTab, setActiveTab] = useState<number>(0);

	const trendingFeedQuery = useTrendingFeed();
	const newFeedQuery = useNewFeed();
	const forYouFeedQuery = useForYouFeed();

	// Determine initial tab based on user status
	useEffect(() => {
		if (!authLoading) {
			const defaultTab = getDefaultDiscoveryTab(user, isLoggedIn);
			setActiveTab(defaultTab);
		}
	}, [authLoading, isLoggedIn, user]);

	const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);
	};

	// Show loading during auth transitions
	if (authLoading) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
				<Typography>Loading...</Typography>
			</Box>
		);
	}

	return (
		<Box
			sx={{
				display: "flex",
				flexGrow: 1,
				height: "100%",
				overflow: "hidden",
			}}
		>
			{/* Main Content */}
			<Box
				component="main"
				sx={{
					flexGrow: 1,
					p: { xs: 2, sm: 3, md: 4 },
					overflowY: "auto",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
					style={{ width: "100%", maxWidth: "1200px", marginBottom: "2rem" }}
				>
					<Container maxWidth="lg" sx={{ textAlign: "center", py: 3 }}>
						<Typography
							variant="h3"
							sx={{
								mb: 2,
								background: "linear-gradient(45deg, #6366f1, #ec4899)",
								backgroundClip: "text",
								WebkitBackgroundClip: "text",
								color: "transparent",
								fontWeight: 700,
								fontSize: { xs: "2rem", md: "2.5rem" },
							}}
						>
							Discover
						</Typography>
						<Typography
							variant="h6"
							sx={{
								color: "text.secondary",
								fontSize: { xs: "1rem", md: "1.1rem" },
								lineHeight: 1.6,
							}}
						>
							Explore trending content, discover new images, and find your personalized feed
						</Typography>
					</Container>
				</motion.div>

				{/* Tabs */}
				<Box sx={{ width: "100%", maxWidth: "1200px" }}>
					<Tabs
						value={activeTab}
						onChange={handleTabChange}
						aria-label="discovery feed tabs"
						centered
						sx={{
							mb: 2,
							"& .MuiTabs-indicator": {
								background: "linear-gradient(45deg, #6366f1, #ec4899)",
								height: 3,
							},
							"& .MuiTab-root": {
								textTransform: "none",
								fontSize: "1rem",
								fontWeight: 600,
								minWidth: 120,
								color: "text.secondary",
								"&.Mui-selected": {
									background: `linear-gradient(45deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(
										theme.palette.secondary.main,
										0.1
									)})`,
									color: "primary.main",
								},
								"&:hover": {
									backgroundColor: alpha(theme.palette.primary.main, 0.05),
								},
							},
						}}
					>
						<Tab icon={<FiberNew />} label="New" id="discovery-tab-0" aria-controls="discovery-tabpanel-0" />
						<Tab icon={<TrendingUp />} label="Trending" id="discovery-tab-1" aria-controls="discovery-tabpanel-1" />
						{isLoggedIn && (
							<Tab icon={<Favorite />} label="For You" id="discovery-tab-2" aria-controls="discovery-tabpanel-2" />
						)}
					</Tabs>

					{/* Tab Panels */}
					<TabPanel value={activeTab} index={0}>
						<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
							<Gallery
								images={newFeedQuery.data?.pages.flatMap((page) => page.data) || []}
								fetchNextPage={newFeedQuery.fetchNextPage}
								hasNextPage={!!newFeedQuery.hasNextPage}
								isFetchingNext={newFeedQuery.isFetchingNextPage}
								isLoadingFiltered={false}
								isLoadingAll={newFeedQuery.isLoading}
							/>
						</motion.div>
					</TabPanel>

					<TabPanel value={activeTab} index={1}>
						<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
							<Gallery
								images={trendingFeedQuery.data?.pages.flatMap((page) => page.data) || []}
								fetchNextPage={trendingFeedQuery.fetchNextPage}
								hasNextPage={!!trendingFeedQuery.hasNextPage}
								isFetchingNext={trendingFeedQuery.isFetchingNextPage}
								isLoadingFiltered={false}
								isLoadingAll={trendingFeedQuery.isLoading}
							/>
						</motion.div>
					</TabPanel>

					{isLoggedIn && (
						<TabPanel value={activeTab} index={2}>
							<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
								<Gallery
									images={forYouFeedQuery.data?.pages.flatMap((page) => page.data) || []}
									fetchNextPage={forYouFeedQuery.fetchNextPage}
									hasNextPage={!!forYouFeedQuery.hasNextPage}
									isFetchingNext={forYouFeedQuery.isFetchingNextPage}
									isLoadingFiltered={false}
									isLoadingAll={forYouFeedQuery.isLoading}
								/>
							</motion.div>
						</TabPanel>
					)}

					{/* Empty State */}
					{!isLoggedIn && (
						<Box sx={{ textAlign: "center", py: 6 }}>
							<Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
								Sign in to see your personalized "For You" feed based on your interests and interactions.
							</Typography>
						</Box>
					)}
				</Box>
			</Box>
		</Box>
	);
};

export default Discovery;
