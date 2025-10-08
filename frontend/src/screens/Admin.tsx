import React, { useState } from "react";
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
} from "@mui/material";
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
import { AdminUserDTO, IImage } from "../types";
import { formatDistanceToNow } from "date-fns";

interface TabPanelProps {
	children?: React.ReactNode;
	index: number;
	value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
	<div hidden={value !== index}>{value === index && <Box sx={{ py: 3 }}>{children}</Box>}</div>
);

export const AdminDashboard: React.FC = () => {
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
				<Tab icon={<ImageIcon />} label="images" />
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
							<Card>
								<CardContent>
									<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
										<PersonIcon color="primary" sx={{ fontSize: 40 }} />
										<Box>
											<Typography color="text.secondary" variant="body2">
												total users
											</Typography>
											<Typography variant="h4">{stats?.totalUsers || 0}</Typography>
											<Typography variant="caption" color="success.main">
												+{stats?.recentUsers || 0} this month
											</Typography>
										</Box>
									</Box>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={3}>
							<Card>
								<CardContent>
									<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
										<ImageIcon color="secondary" sx={{ fontSize: 40 }} />
										<Box>
											<Typography color="text.secondary" variant="body2">
												total images
											</Typography>
											<Typography variant="h4">{stats?.totalImages || 0}</Typography>
											<Typography variant="caption" color="success.main">
												+{stats?.recentImages || 0} this month
											</Typography>
										</Box>
									</Box>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={3}>
							<Card>
								<CardContent>
									<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
										<BlockIcon color="error" sx={{ fontSize: 40 }} />
										<Box>
											<Typography color="text.secondary" variant="body2">
												banned users
											</Typography>
											<Typography variant="h4">{stats?.bannedUsers || 0}</Typography>
										</Box>
									</Box>
								</CardContent>
							</Card>
						</Grid>

						<Grid item xs={12} sm={6} md={3}>
							<Card>
								<CardContent>
									<Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
										<AdminPanelSettingsIcon color="warning" sx={{ fontSize: 40 }} />
										<Box>
											<Typography color="text.secondary" variant="body2">
												admin users
											</Typography>
											<Typography variant="h4">{stats?.adminUsers || 0}</Typography>
										</Box>
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
										<TableCell>image</TableCell>
										<TableCell>title</TableCell>
										<TableCell>uploader</TableCell>
										<TableCell>likes</TableCell>
										<TableCell>uploaded</TableCell>
										<TableCell>actions</TableCell>
									</TableRow>
								</TableHead>
								<TableBody>
									{imagesData?.data.map((image: IImage) => (
										<TableRow key={image.publicId}>
											<TableCell>
												<Avatar variant="rounded" src={image.url} sx={{ width: 60, height: 60 }} />
											</TableCell>
											<TableCell>{image.title || "untitled"}</TableCell>
											<TableCell>{image.user?.username}</TableCell>
											<TableCell>{image.likes || 0}</TableCell>
											<TableCell>{formatDistanceToNow(new Date(image.createdAt), { addSuffix: true })}</TableCell>
											<TableCell>
												<IconButton
													size="small"
													color="error"
													onClick={() => {
														if (window.confirm("delete this image? this cannot be undone.")) {
															deleteImageMutation.mutate(image.publicId);
														}
													}}
													title="delete image"
												>
													<DeleteIcon />
												</IconButton>
											</TableCell>
										</TableRow>
									))}
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
