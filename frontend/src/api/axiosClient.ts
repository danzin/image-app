import axios from "axios";

const axiosClient = axios.create({
	baseURL: import.meta.env.VITE_API_URL || "",
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
		const rawMessage = error?.response?.data?.message;

		// Extract the backend error message if available
		if (rawMessage) {
			error.message = rawMessage;
		}

		if (typeof error.message === "string") {
			const sanitized = error.message
				.replace(/\bUoW\b/gi, "transaction")
				.replace(/\btransaction\b/gi, "request")
				.replace(/internal server error/gi, "something went wrong")
				.replace(/error\s*\d+/gi, "error")
				.replace(/\bDatabase\b/gi, "service")
				.replace(/\bMongoDB\b/gi, "service");
			error.message = sanitized;
		}

		if (status === 401 || status === 403) {
			console.warn("[Axios] Auth error status", status, "- user session expired");
		}
		return Promise.reject(error);
	}
);
