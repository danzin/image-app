import axios from "axios";

const axiosClient = axios.create({
	baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
	},
});

export default axiosClient;

// Global response interceptor to catch auth expiry
axiosClient.interceptors.response.use(
	(response) => response,
	(error) => {
		const status = error?.response?.status;
		if (status === 401 || status === 403) {
			console.warn("[Axios] Auth error status", status, "- user session expired");
		}
		return Promise.reject(error);
	}
);
