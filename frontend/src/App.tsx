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
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { GalleryProvider } from "./context/GalleryContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { theme } from "./theme/theme";
import SearchResults from "./screens/SearchResults";
import { SocketProvider } from "./context/Socket/SocketProvider";
import AuthProvider from "./context/Auth/AuthProvider";
import ImageView from "./screens/ImageView";
import PostView from "./screens/PostView";
import Favorites from "./screens/Favorites";
import Messages from "./screens/Messages";
import Notifications from "./screens/Notifications";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";

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
							<GalleryProvider>
								<Routes>
									<Route path="/" element={<Layout />}>
										<Route index element={<Home />} />
										<Route path="discover" element={<Discovery />} />
										<Route path="login" element={<Login />} />
										<Route path="register" element={<Register />} />
										<Route path="profile/:id" element={<Profile />} />
										<Route path="/results" element={<SearchResults />} />
										<Route path="images/:id" element={<ImageView />} />
										<Route path="posts/:id" element={<PostView />} />
										<Route path="favorites" element={<ProtectedRoute element={<Favorites />} />} />
										<Route path="messages" element={<ProtectedRoute element={<Messages />} />} />
										<Route path="notifications" element={<ProtectedRoute element={<Notifications />} />} />
										<Route path="admin" element={<AdminRoute element={<AdminDashboard />} />} />
									</Route>
								</Routes>
								<ReactQueryDevtools initialIsOpen={false} />
							</GalleryProvider>
						</SocketProvider>
					</AuthProvider>
				</QueryClientProvider>
			</BrowserRouter>
		</ThemeProvider>
	);
}

export default App;
