import React from "react";
import { Box, Typography, Chip, CircularProgress, alpha, useTheme } from "@mui/material";
import { TrendingUp as TrendingUpIcon, LocalOffer as LocalOfferIcon } from "@mui/icons-material";
import { useQuery } from "@tanstack/react-query";
import { feedApi } from "../api/feedApi";
import { useNavigate } from "react-router-dom";

const TrendingTags: React.FC = () => {
	const theme = useTheme();
	const navigate = useNavigate();

	const timeWindowHours = 168;
	const limit = 5;
	const { data, isLoading, error } = useQuery({
		queryKey: ["trending-tags", limit, timeWindowHours],
		queryFn: () => feedApi.getTrendingTags(limit, timeWindowHours),
		staleTime: 1000 * 60 * 15,
		refetchInterval: 1000 * 60 * 15,
	});

	const handleTagClick = (tag: string) => {
		navigate(`/results?q=${encodeURIComponent(tag)}`);
	};

	if (isLoading) {
		return (
			<Box
				sx={{
					p: 3,
					borderRadius: 3,
					background: "linear-gradient(145deg, rgba(26, 26, 46, 0.6) 0%, rgba(22, 33, 62, 0.6) 100%)",
					border: "1px solid rgba(99, 102, 241, 0.2)",
				}}
			>
				<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
					<TrendingUpIcon sx={{ color: theme.palette.primary.main }} />
					<Typography variant="h6" sx={{ fontWeight: 600 }}>
						Trending Tags
					</Typography>
				</Box>
				<Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
					<CircularProgress size={24} />
				</Box>
			</Box>
		);
	}

	if (error || !data || data.tags.length === 0) {
		return null; // silently hide if no data or error
	}

	return (
		<Box
			sx={{
				p: 3,
				borderRadius: 3,
				background: "linear-gradient(145deg, rgba(26, 26, 46, 0.6) 0%, rgba(22, 33, 62, 0.6) 100%)",
				border: "1px solid rgba(99, 102, 241, 0.2)",
				transition: "all 0.3s ease",
				"&:hover": {
					borderColor: "rgba(99, 102, 241, 0.4)",
				},
			}}
		>
			<Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
				<TrendingUpIcon sx={{ color: theme.palette.primary.main }} />
				<Typography variant="h6" sx={{ fontWeight: 600 }}>
					Trending Tags
				</Typography>
			</Box>
			<Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
				{data.tags.map((trendingTag, index) => (
					<Chip
						key={trendingTag.tag}
						icon={<LocalOfferIcon sx={{ fontSize: 16 }} />}
						label={
							<Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
								<Typography
									variant="body2"
									sx={{
										flex: 1,
										fontWeight: 500,
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
									}}
								>
									{trendingTag.tag}
								</Typography>
								<Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
									{trendingTag.count}
								</Typography>
							</Box>
						}
						onClick={() => handleTagClick(trendingTag.tag)}
						sx={{
							width: "100%",
							justifyContent: "flex-start",
							px: 2,
							py: 2.5,
							cursor: "pointer",
							background:
								index === 0
									? "linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(236, 72, 153, 0.2))"
									: alpha(theme.palette.background.paper, 0.3),
							border: index === 0 ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid rgba(99, 102, 241, 0.15)",
							"&:hover": {
								background:
									index === 0
										? "linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(236, 72, 153, 0.3))"
										: alpha(theme.palette.background.paper, 0.5),
								borderColor: theme.palette.primary.main,
								transform: "translateX(4px)",
							},
							"& .MuiChip-icon": {
								color: index === 0 ? theme.palette.primary.light : theme.palette.text.secondary,
								marginLeft: 0,
							},
							"& .MuiChip-label": {
								width: "100%",
								px: 1,
							},
							transition: "all 0.2s ease",
						}}
					/>
				))}
			</Box>
		</Box>
	);
};

export default TrendingTags;
