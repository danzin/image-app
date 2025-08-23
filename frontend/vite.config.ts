import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");

	return {
		// Allows using processs.env
		define: {
			"process.env": JSON.stringify(env),
		},
		plugins: [react()],

		server: {
			port: 5173,
			proxy: {
				// forward /api/* → API Gateway on :8000
				"/api": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
					ws: true, // proxy websockets for socket.io
				},
				// forward /uploads/* → Gateway
				"/uploads": {
					target: "http://localhost:8000",
					changeOrigin: true,
					secure: false,
				},
			},
		},
	};
});
