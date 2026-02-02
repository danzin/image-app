import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Link as RouterLink } from "react-router-dom";
import {
	Box,
	Container,
	Typography,
	Card,
	CardContent,
	Grid,
	Avatar,
	Chip,
	Button,
	Divider,
	CircularProgress,
	Link,
} from "@mui/material";
import {
	ArrowBack as ArrowBackIcon,
	Email as EmailIcon,
	CalendarToday as CalendarTodayIcon,
} from "@mui/icons-material";
import { useAdminUser, useUserStats } from "../hooks/admin/useAdmin";
import { formatDistanceToNow } from "date-fns";

const AdminUserDetail: React.FC = () => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();

	const { data: user, isLoading: userLoading } = useAdminUser(id);
	const { data: stats, isLoading: statsLoading } = useUserStats(id);

	if (userLoading || statsLoading) {
		return (
			<Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
				<CircularProgress />
			</Box>
		);
	}

	if (!user) {
		return (
			<Container maxWidth="lg" sx={{ py: 4 }}>
				<Typography variant="h5">User not found</Typography>
				<Button onClick={() => navigate("/admin")} startIcon={<ArrowBackIcon />} sx={{ mt: 2 }}>
					Back to Dashboard
				</Button>
			</Container>
		);
	}

	return (
		<Container maxWidth="lg" sx={{ py: 4 }}>
			<Button onClick={() => navigate("/admin")} startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
				Back to Dashboard
			</Button>

			<Grid container spacing={3}>
				{/* Header Card */}
				<Grid item xs={12}>
					<Card>
						<CardContent>
							<Box sx={{ display: "flex", alignItems: "center", gap: 3 }}>
								<Avatar src={user.avatar} sx={{ width: 100, height: 100 }} />
								<Box>
									<Link
										component={RouterLink}
										to={`/profile/${user.handle || user.publicId}`}
										underline="hover"
										color="inherit"
									>
										<Typography variant="h4" gutterBottom>
											{user.username}
										</Typography>
									</Link>
									<Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
										<Chip
											label={user.isAdmin ? "Admin" : "User"}
											color={user.isAdmin ? "warning" : "default"}
											size="small"
										/>
										<Chip
											label={user.isBanned ? "Banned" : "Active"}
											color={user.isBanned ? "error" : "success"}
											size="small"
										/>
										<Chip label={user.isEmailVerified ? "Verified" : "Unverified"} size="small" variant="outlined" />
									</Box>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
										<EmailIcon fontSize="small" />
										<Typography variant="body2">{user.email}</Typography>
									</Box>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", mt: 0.5 }}>
										<CalendarTodayIcon fontSize="small" />
										<Typography variant="body2">
											Joined {new Date(user.createdAt).toLocaleDateString()} (
											{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })})
										</Typography>
									</Box>
									<Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary", mt: 0.5 }}>
										<Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
											Last Active:{" "}
											{stats?.lastActivity
												? formatDistanceToNow(new Date(stats.lastActivity), { addSuffix: true })
												: "N/A"}
										</Typography>
									</Box>
									<Box sx={{ mt: 1 }}>
										<Typography variant="caption" color="text.secondary">
											ID: {user.publicId}
										</Typography>
									</Box>
								</Box>
							</Box>
						</CardContent>
					</Card>
				</Grid>

				{/* Stats Cards */}
				<Grid item xs={12} md={6}>
					<Card sx={{ height: "100%" }}>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Account Statistics
							</Typography>
							<Divider sx={{ mb: 2 }} />
							<Grid container spacing={2}>
								<Grid item xs={6}>
									<Typography variant="body2" color="text.secondary">
										Total Posts
									</Typography>
									<Typography variant="h6">{stats?.imageCount || 0}</Typography>
								</Grid>
								<Grid item xs={6}>
									<Typography variant="body2" color="text.secondary">
										Total Likes Received
									</Typography>
									<Typography variant="h6">{stats?.likeCount || 0}</Typography>
								</Grid>
								<Grid item xs={6}>
									<Typography variant="body2" color="text.secondary">
										Followers
									</Typography>
									<Typography variant="h6">{stats?.followerCount || 0}</Typography>
								</Grid>
								<Grid item xs={6}>
									<Typography variant="body2" color="text.secondary">
										Following
									</Typography>
									<Typography variant="h6">{stats?.followingCount || 0}</Typography>
								</Grid>
							</Grid>
						</CardContent>
					</Card>
				</Grid>

				<Grid item xs={12} md={6}>
					<Card sx={{ height: "100%" }}>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Security & Info
							</Typography>
							<Divider sx={{ mb: 2 }} />
							<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
								<Box sx={{ display: "flex", justifyContent: "space-between" }}>
									<Typography variant="body2" color="text.secondary">
										Registration Date
									</Typography>
									<Typography variant="body2">{new Date(user.createdAt).toLocaleString()}</Typography>
								</Box>
								<Box sx={{ display: "flex", justifyContent: "space-between" }}>
									<Typography variant="body2" color="text.secondary">
										Registration IP
									</Typography>
									<Typography variant="body2">{user.registrationIp || "N/A"}</Typography>
								</Box>
								<Box sx={{ display: "flex", justifyContent: "space-between" }}>
									<Typography variant="body2" color="text.secondary">
										Last Activity
									</Typography>
									<Typography variant="body2">
										{stats?.lastActivity
											? `${new Date(stats.lastActivity).toLocaleString()} (${formatDistanceToNow(
													new Date(stats.lastActivity),
													{ addSuffix: true },
												)})`
											: "N/A"}
									</Typography>
								</Box>
								<Box sx={{ display: "flex", justifyContent: "space-between" }}>
									<Typography variant="body2" color="text.secondary">
										Last IP
									</Typography>
									<Typography variant="body2">{stats?.lastIp || "N/A"}</Typography>
								</Box>
							</Box>
						</CardContent>
					</Card>
				</Grid>
			</Grid>
		</Container>
	);
};

export default AdminUserDetail;
