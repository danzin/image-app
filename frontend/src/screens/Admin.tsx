import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	Box,
	Container,
	Typography,
	Tabs,
	Tab,
	Card,
	CardContent,
	Grid,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	Paper,
	Button,
	Chip,
	Dialog,
	DialogTitle,
	DialogContent,
	DialogActions,
	TextField,
	IconButton,
	Avatar,
	TablePagination,
	CircularProgress,
	useTheme,
} from "@mui/material";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
	Dashboard as DashboardIcon,
	People as PeopleIcon,
	Image as ImageIcon,
	Delete as DeleteIcon,
	Block as BlockIcon,
	CheckCircle as CheckCircleIcon,
	AdminPanelSettings as AdminPanelSettingsIcon,
	RemoveCircle as RemoveCircleIcon,
	// TrendingUp as TrendingUpIcon,
	Person as PersonIcon,
} from "@mui/icons-material";
import {
	useAdminUsers,
	useAdminImages,
	useDashboardStats,
	useRecentActivity,
	useBanUser,
	useUnbanUser,
	usePromoteToAdmin,
	useDemoteFromAdmin,
	useDeleteUserAdmin,
	useDeleteImageAdmin,
	useClearCache,
} from "../hooks/admin/useAdmin";
import { AdminUserDTO, IPost } from "../types";
import { formatDistanceToNow } from "date-fns";

interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
	<div hidden={value !== index}>{value === index && <Box sx={{ py: 3 }}>{children}</Box>}</div>
);

const chartData = [
	{ name: "May", users: 4000 },
	{ name: "Jun", users: 5000 },
	{ name: "Jul", users: 6200 },
	{ name: "Aug", users: 5800 },
	{ name: "Sep", users: 7200 },
	{ name: "Oct", users: 8000 },
];

interface StatCardProps {
	title: string;
	value: string | number;
	change?: string;
	icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon }) => {
	const theme = useTheme();
	const isPositive = change?.startsWith("+");

	return (
		<Card
			sx={{
				background: `linear-gradient(145deg, ${theme.palette.background.paper} 0%, ${theme.palette.background.default} 100%)`,
				border: `1px solid ${theme.palette.divider}`,
			}}
		>
			<CardContent>
				<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
					<Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
						{title}
					</Typography>
					<Box sx={{ color: "primary.main", opacity: 0.8 }}>{icon}</Box>
				</Box>
				<Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
					{value}
				</Typography>
				{change && (
					<Typography variant="body2" sx={{ color: isPositive ? "success.main" : "error.main" }}>
						{change}
					</Typography>
				)}
			</CardContent>
		</Card>
	);
};

export const AdminDashboard: React.FC = () => {
	const navigate = useNavigate();
	const [currentTab, setCurrentTab] = useState(0);
	const [userPage, setUserPage] = useState(0);
	const [imagePage, setImagePage] = useState(0);
	const [rowsPerPage, setRowsPerPage] = useState(10);
	const [banDialogOpen, setBanDialogOpen] = useState(false);
	const [selectedUser, setSelectedUser] = useState<AdminUserDTO | null>(null);
	const [banReason, setBanReason] = useState("");

	const { data: stats, isLoading: statsLoading } = useDashboardStats();
	const { data: usersData, isLoading: usersLoading } = useAdminUsers({
		page: userPage + 1,
		limit: rowsPerPage,
	});
	const { data: imagesData, isLoading: imagesLoading } = useAdminImages({
		page: imagePage + 1,
		limit: rowsPerPage,
	});
	const { data: activityData } = useRecentActivity({ page: 1, limit: 10 });

	const banUserMutation = useBanUser();
	const unbanUserMutation = useUnbanUser();
	const promoteUserMutation = usePromoteToAdmin();
	const demoteUserMutation = useDemoteFromAdmin();
	const deleteUserMutation = useDeleteUserAdmin();
	const deleteImageMutation = useDeleteImageAdmin();
	const clearCacheMutation = useClearCache();

	const handleBanUser = () => {
		if (selectedUser && banReason.trim()) {
			banUserMutation.mutate(
				{ publicId: selectedUser.publicId, reason: banReason },
				{
					onSuccess: () => {
						setBanDialogOpen(false);
						setBanReason("");
						setSelectedUser(null);
					},
				}
			);
		}
	};

	const openBanDialog = (user: AdminUserDTO) => {
		setSelectedUser(user);
		setBanDialogOpen(true);
	};

	return (
		<Container maxWidth="xl" sx={{ py: 4 }}>
			<Box sx={{ mb: 4 }}>
				<Typography variant="h4" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
					<AdminPanelSettingsIcon fontSize="large" />
					admin dashboard
				</Typography>
			</Box>

			<Tabs value={currentTab} onChange={(_, newValue) => setCurrentTab(newValue)} sx={{ mb: 3 }}>
				<Tab icon={<DashboardIcon />} label="overview" />
				<Tab icon={<PeopleIcon />} label="users" />
				<Tab icon={<ImageIcon />} label="posts" />
			</Tabs>

			{/* overview tab */}
			<TabPanel value={currentTab} index={0}>
				{statsLoading ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
						<CircularProgress />
					</Box>
				) : (
					<Grid container spacing={3}>
						<Grid item xs={12} sm={6} md={3}>
							<StatCard
								title="Total Users"
								value={stats?.totalUsers || 0}
								change={`+${stats?.recentUsers || 0} this month`}
								icon={<PersonIcon sx={{ fontSize: 40 }} />}
							/>
						</Grid>

						<Grid item xs={12} sm={6} md={3}>
							<StatCard
								title="Total Posts"
								value={stats?.totalImages || 0}
								change={`+${stats?.recentImages || 0} this month`}
								icon={<ImageIcon sx={{ fontSize: 40 }} />}
							/>
						</Grid>

						<Grid item xs={12} sm={6} md={3}>
							<StatCard
								title="Banned Users"
								value={stats?.bannedUsers || 0}
								icon={<BlockIcon sx={{ fontSize: 40 }} />}
							/>
						</Grid>

						<Grid item xs={12} sm={6} md={3}>
							<StatCard
								title="Admin Users"
								value={stats?.adminUsers || 0}
								icon={<AdminPanelSettingsIcon sx={{ fontSize: 40 }} />}
							/>
						</Grid>

						<Grid item xs={12}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
										New Users (Last 6 Months)
									</Typography>
									<Box sx={{ width: "100%", height: 300 }}>
										<ResponsiveContainer>
											<BarChart data={chartData}>
												<CartesianGrid strokeDasharray="3 3" stroke="#38444d" />
												<XAxis dataKey="name" stroke="#8899A6" />
												<YAxis stroke="#8899A6" />
												<Tooltip
													contentStyle={{
														backgroundColor: "#192734",
														border: "1px solid #38444d",
														borderRadius: "8px",
													}}
													cursor={{ fill: "rgba(99, 102, 241, 0.1)" }}
												/>
												<Legend />
												<Bar dataKey="users" fill="#6366f1" radius={[8, 8, 0, 0]} />
											</BarChart>
										</ResponsiveContainer>
									</Box>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12}>
							<Card>
								<CardContent>
									<Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
										<Typography variant="h6">cache management</Typography>
										<Button
											variant="contained"
											color="warning"
											onClick={() => clearCacheMutation.mutate("feed:*")}
											disabled={clearCacheMutation.isPending}
										>
											{clearCacheMutation.isPending ? "clearing..." : "clear feed cache"}
										</Button>
									</Box>
									<Typography variant="body2" color="text.secondary">
										clear Redis cache to force feed regeneration. useful when feed data seems stale after deletions or
										updates.
									</Typography>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12}>
							<Card>
								<CardContent>
									<Typography variant="h6" gutterBottom>
										Recent activity
									</Typography>
									<TableContainer>
										<Table size="small">
											<TableHead>
												<TableRow>
													<TableCell>user</TableCell>
													<TableCell>action</TableCell>
													<TableCell>target</TableCell>
													<TableCell>time</TableCell>
												</TableRow>
											</TableHead>
											<TableBody>
												{activityData?.data.slice(0, 5).map((activity, idx) => (
													<TableRow key={idx}>
														<TableCell>{activity.username}</TableCell>
														<TableCell>{activity.action}</TableCell>
														<TableCell>{activity.targetType}</TableCell>
														<TableCell>
															{formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
														</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									</TableContainer>
								</CardContent>
							</Card>
						</Grid>
					</Grid>
				)}
			</TabPanel>

			{/* users tab */}
			<TabPanel value={currentTab} index={1}>
				{usersLoading ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
						<CircularProgress />
					</Box>
				) : (
					<Paper>
						<TableContainer>
							<Table>
								<TableHead>
									<TableRow>
										<TableCell>user</TableCell>
										<TableCell>email</TableCell>
										<TableCell>status</TableCell>
										<TableCell>joined</TableCell>
										<TableCell>actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{usersData?.data.map((user) => (
										<TableRow key={user.publicId}>
											<TableCell>
												<Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
													<Avatar src={user.avatar} sx={{ width: 32, height: 32 }}>
														{user.username.charAt(0).toUpperCase()}
													</Avatar>
													<Box>
														<Typography variant="body2">{user.username}</Typography>
														{user.isAdmin && <Chip label="admin" size="small" color="warning" />}
													</Box>
												</Box>
											</TableCell>
											<TableCell>{user.email}</TableCell>
											<TableCell>
												{user.isBanned ? (
													<Chip label="banned" size="small" color="error" />
												) : (
													<Chip label="active" size="small" color="success" />
												)}
											</TableCell>
											<TableCell>{formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</TableCell>
											<TableCell>
												<Box sx={{ display: "flex", gap: 1 }}>
													{user.isBanned ? (
														<IconButton
															size="small"
															color="success"
															onClick={() => unbanUserMutation.mutate(user.publicId)}
															title="unban user"
														>
															<CheckCircleIcon />
														</IconButton>
													) : (
														<IconButton size="small" color="error" onClick={() => openBanDialog(user)} title="ban user">
															<BlockIcon />
														</IconButton>
													)}
													{user.isAdmin ? (
														<IconButton
															size="small"
															onClick={() => demoteUserMutation.mutate(user.publicId)}
															title="remove admin"
														>
															<RemoveCircleIcon />
														</IconButton>
													) : (
														<IconButton
															size="small"
															color="warning"
															onClick={() => promoteUserMutation.mutate(user.publicId)}
															title="make admin"
														>
															<AdminPanelSettingsIcon />
														</IconButton>
													)}
													<IconButton
														size="small"
														color="error"
														onClick={() => {
															if (window.confirm(`delete user ${user.username}? this cannot be undone.`)) {
																deleteUserMutation.mutate(user.publicId);
															}
														}}
														title="delete user"
													>
														<DeleteIcon />
													</IconButton>
												</Box>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</TableContainer>
						<TablePagination
							component="div"
							count={usersData?.total || 0}
							page={userPage}
							onPageChange={(_, newPage) => setUserPage(newPage)}
							rowsPerPage={rowsPerPage}
							onRowsPerPageChange={(e) => {
								setRowsPerPage(parseInt(e.target.value, 10));
								setUserPage(0);
							}}
						/>
					</Paper>
				)}
			</TabPanel>

			{/* images tab */}
			<TabPanel value={currentTab} index={2}>
				{imagesLoading ? (
					<Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
						<CircularProgress />
					</Box>
				) : (
					<Paper>
						<TableContainer>
							<Table>
								<TableHead>
									<TableRow>
										<TableCell>preview</TableCell>
										<TableCell>content</TableCell>
										<TableCell>author</TableCell>
										<TableCell>likes</TableCell>
										<TableCell>posted</TableCell>
										<TableCell>actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{imagesData?.data.map((post: IPost) => {
										const imageUrl = post.image?.url || post.url;
										const hasImage = !!imageUrl;
										const contentPreview = post.body
											? post.body.length > 50
												? post.body.substring(0, 50) + "..."
												: post.body
											: hasImage
												? "[image only]"
												: "[no content]";
										return (
											<TableRow
												key={post.publicId}
												sx={{
													cursor: "pointer",
													"&:hover": { bgcolor: "rgba(255,255,255,0.05)" },
												}}
												onClick={() => navigate(`/posts/${post.publicId}`)}
											>
												<TableCell>
													{hasImage ? (
														<Avatar variant="rounded" src={imageUrl} sx={{ width: 60, height: 60 }} />
													) : (
														<Avatar variant="rounded" sx={{ width: 60, height: 60, bgcolor: "grey.800" }}>
															<ImageIcon />
														</Avatar>
													)}
												</TableCell>
												<TableCell>
													<Typography variant="body2" sx={{ maxWidth: 200 }}>
														{contentPreview}
													</Typography>
												</TableCell>
												<TableCell
													onClick={(e) => {
														e.stopPropagation();
														if (post.user?.publicId) {
															navigate(`/profile/${post.user.publicId}`);
														}
													}}
													sx={{
														"&:hover": { color: "primary.main", textDecoration: "underline" },
													}}
												>
													{post.user?.username}
												</TableCell>
												<TableCell>{post.likes || 0}</TableCell>
												<TableCell>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</TableCell>
												<TableCell onClick={(e) => e.stopPropagation()}>
													<IconButton
														size="small"
														color="error"
														onClick={() => {
															if (window.confirm("delete this post? this cannot be undone.")) {
																deleteImageMutation.mutate(post.publicId);
															}
														}}
														title="delete post"
													>
														<DeleteIcon />
													</IconButton>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</TableContainer>
						<TablePagination
							component="div"
							count={imagesData?.total || 0}
							page={imagePage}
							onPageChange={(_, newPage) => setImagePage(newPage)}
							rowsPerPage={rowsPerPage}
							onRowsPerPageChange={(e) => {
								setRowsPerPage(parseInt(e.target.value, 10));
								setImagePage(0);
							}}
						/>
					</Paper>
				)}
			</TabPanel>

			{/* ban user dialog */}
			<Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)} maxWidth="sm" fullWidth>
				<DialogTitle>ban user: {selectedUser?.username}</DialogTitle>
				<DialogContent>
					<TextField
						autoFocus
						margin="dense"
						label="ban reason"
						fullWidth
						multiline
						rows={3}
						value={banReason}
						onChange={(e) => setBanReason(e.target.value)}
						placeholder="provide reason for ban"
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={() => setBanDialogOpen(false)}>cancel</Button>
					<Button
						onClick={handleBanUser}
						variant="contained"
						color="error"
						disabled={!banReason.trim() || banUserMutation.isPending}
					>
						{banUserMutation.isPending ? "banning..." : "ban user"}
					</Button>
				</DialogActions>
			</Dialog>
		</Container>
	);
};
