import axios from "axios";

const axiosClient = axios.create({
	baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
	},
});

// Add request interceptor for auth token
axiosClient.interceptors.request.use(
	(config) => {
		const token = localStorage.getItem("token");
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error)
);

export default axiosClient;

// Global response interceptor to catch auth expiry and cleanup
axiosClient.interceptors.response.use(
	(response) => response,
	(error) => {
		const status = error?.response?.status;
		if (status === 401 || status === 403) {
			try {
				console.warn("[Axios] Auth error status", status, "- clearing stored token");
				localStorage.removeItem("token");
			} catch {
				// Swallow storage errors (e.g., private mode)
			}
		}
		return Promise.reject(error);
	}
);
