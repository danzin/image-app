import React, { useState } from "react";
import { motion } from "framer-motion";
import { Box, Typography, Tabs, Tab, useTheme, alpha, IconButton, Tooltip } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import Gallery from "../components/Gallery";
import { useAuth } from "../hooks/context/useAuth";
import { useTrendingFeed, useNewFeed, useForYouFeed } from "../hooks/posts/usePosts";

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
			{value === index && <Box>{children}</Box>}
		</div>
	);
};

const Discovery: React.FC = () => {
	const theme = useTheme();
	const { isLoggedIn, loading: authLoading } = useAuth();

	// Start with "new" for new users, "for-you" for existing users
	const [activeTab, setActiveTab] = useState<number>(0);
	const [isRefreshing, setIsRefreshing] = useState(false);

	const trendingFeedQuery = useTrendingFeed({ enabled: activeTab === 1 });
	const newFeedQuery = useNewFeed({ enabled: activeTab === 0 });
	const forYouFeedQuery = useForYouFeed({ enabled: activeTab === 2 });

	const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
		setActiveTab(newValue);
	};

	const handleRefreshNewFeed = async () => {
		if (!isLoggedIn || isRefreshing) return;
		setIsRefreshing(true);
		try {
			await newFeedQuery.refreshFeed();
			await newFeedQuery.refetch();
		} finally {
			setIsRefreshing(false);
		}
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
					p: 0,
					overflowY: "auto",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
				}}
			>
				{/* Tabs */}
				<Box sx={{ width: "100%", borderBottom: 1, borderColor: "divider" }}>
					<Tabs
						value={activeTab}
						onChange={handleTabChange}
						aria-label="discovery feed tabs"
						variant="fullWidth"
						sx={{
							"& .MuiTabs-indicator": {
								height: 4,
								borderRadius: 2,
								bgcolor: "primary.main",
							},
							"& .MuiTab-root": {
								textTransform: "none",
								fontSize: "1rem",
								fontWeight: 700,
								minHeight: 53,
								color: "text.secondary",
								"&.Mui-selected": {
									color: "text.primary",
								},
								"&:hover": {
									backgroundColor: alpha(theme.palette.text.primary, 0.1),
								},
							},
						}}
					>
						<Tab label="New" id="discovery-tab-0" aria-controls="discovery-tabpanel-0" />
						<Tab label="Trending" id="discovery-tab-1" aria-controls="discovery-tabpanel-1" />
						{isLoggedIn && <Tab label="For You" id="discovery-tab-2" aria-controls="discovery-tabpanel-2" />}
					</Tabs>
				</Box>

				<Box sx={{ width: "100%" }}>
					{/* Tab Panels */}
					<TabPanel value={activeTab} index={0}>
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
							{isLoggedIn && (
								<Box sx={{ display: "flex", justifyContent: "flex-end", px: 2, py: 1 }}>
									<Tooltip title="Refresh for latest posts">
										<IconButton
											onClick={handleRefreshNewFeed}
											disabled={isRefreshing}
											size="small"
											sx={{
												animation: isRefreshing ? "spin 1s linear infinite" : "none",
												"@keyframes spin": {
													"0%": { transform: "rotate(0deg)" },
													"100%": { transform: "rotate(360deg)" },
												},
											}}
										>
											<RefreshIcon />
										</IconButton>
									</Tooltip>
								</Box>
							)}
							<Gallery
								posts={newFeedQuery.data?.pages.flatMap((page) => page.data) || []}
								fetchNextPage={newFeedQuery.fetchNextPage}
								hasNextPage={!!newFeedQuery.hasNextPage}
								isFetchingNext={newFeedQuery.isFetchingNextPage}
								isLoadingAll={newFeedQuery.isLoading || newFeedQuery.isPending}
								isFetchingAll={newFeedQuery.isFetching}
							/>
						</motion.div>
					</TabPanel>

					<TabPanel value={activeTab} index={1}>
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
							<Gallery
								posts={trendingFeedQuery.data?.pages.flatMap((page) => page.data) || []}
								fetchNextPage={trendingFeedQuery.fetchNextPage}
								hasNextPage={!!trendingFeedQuery.hasNextPage}
								isFetchingNext={trendingFeedQuery.isFetchingNextPage}
								isLoadingAll={trendingFeedQuery.isLoading || trendingFeedQuery.isPending}
								isFetchingAll={trendingFeedQuery.isFetching}
							/>
						</motion.div>
					</TabPanel>

					{isLoggedIn && (
						<TabPanel value={activeTab} index={2}>
							<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
								<Gallery
									posts={forYouFeedQuery.data?.pages.flatMap((page) => page.data) || []}
									fetchNextPage={forYouFeedQuery.fetchNextPage}
									hasNextPage={!!forYouFeedQuery.hasNextPage}
									isFetchingNext={forYouFeedQuery.isFetchingNextPage}
									isLoadingAll={forYouFeedQuery.isLoading || forYouFeedQuery.isPending}
									isFetchingAll={forYouFeedQuery.isFetching}
								/>
							</motion.div>
						</TabPanel>
					)}
				</Box>

				{/* Empty State */}
				{!isLoggedIn && (
					<Box sx={{ textAlign: "center", py: 6, px: 2 }}>
						<Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
							Sign in to see your personalized "For You" feed based on your interests and interactions.
						</Typography>
					</Box>
				)}
			</Box>
		</Box>
	);
};

export default Discovery;
