import { Route, Routes, BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import Home from "./screens/Home";
import Login from "./screens/Login";
import Register from "./screens/Register";
import Profile from "./screens/Profile";
import Discovery from "./screens/Discovery";
import Layout from "./components/Layout";
import { AdminDashboard } from "./screens/Admin";
import FeedSocketManager from "./components/FeedSocketManager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { theme } from "./theme/theme";
import SearchResults from "./screens/SearchResults";
import { SocketProvider } from "./context/Socket/SocketProvider";
import AuthProvider from "./context/Auth/AuthProvider";
import PostView from "./screens/PostView";
import Favorites from "./screens/Favorites";
import Messages from "./screens/Messages";
import Notifications from "./screens/Notifications";
import Settings from "./screens/Settings";
import FollowList from "./screens/FollowList";
import ForgotPassword from "./screens/ForgotPassword";
import ResetPassword from "./screens/ResetPassword";
import VerifyEmail from "./screens/VerifyEmail";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { CommentThreadView } from "./components/comments";
import Communities from "./screens/Communities";
import CommunityDetails from "./screens/CommunityDetails";
import CommunityMembers from "./screens/CommunityMembers";

import AdminUserDetail from "./screens/AdminUserDetail";

// initialize telemetry on app load
import "./lib/telemetry";

function App() {
	const queryClient = new QueryClient();

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<BrowserRouter>
				<QueryClientProvider client={queryClient}>
					<AuthProvider>
						<SocketProvider>
							<FeedSocketManager />
							<Routes>
								<Route path="/" element={<Layout />}>
									<Route index element={<Home />} />
									<Route path="discover" element={<Discovery />} />
									<Route path="communities" element={<Communities />} />
									<Route path="communities/:slug" element={<CommunityDetails />} />
									<Route path="communities/:slug/members" element={<CommunityMembers />} />
									<Route path="login" element={<Login />} />
									<Route path="forgot-password" element={<ForgotPassword />} />
									<Route path="reset-password" element={<ResetPassword />} />
									<Route path="verify-email" element={<VerifyEmail />} />
									<Route path="register" element={<Register />} />
									<Route path="profile/:id" element={<Profile />} />
									<Route path="profile/:id/follow" element={<FollowList />} />
									<Route path="/results" element={<SearchResults />} />
									<Route path="posts/:id" element={<PostView />} />
									<Route path="comments/:commentId" element={<CommentThreadView />} />
									<Route path="favorites" element={<ProtectedRoute element={<Favorites />} />} />
									<Route path="messages" element={<ProtectedRoute element={<Messages />} />} />
									<Route path="notifications" element={<ProtectedRoute element={<Notifications />} />} />
									<Route path="settings" element={<ProtectedRoute element={<Settings />} />} />
									<Route path="admin" element={<AdminRoute element={<AdminDashboard />} />} />
									<Route path="admin/users/:id" element={<AdminRoute element={<AdminUserDetail />} />} />
								</Route>
							</Routes>
						</SocketProvider>
					</AuthProvider>
				</QueryClientProvider>
			</BrowserRouter>
		</ThemeProvider>
	);
}

export default App;
