export function buildCorsOptions() {
	const envOrigins = process.env.ALLOWED_ORIGINS?.split(/[,\s]+/).filter(Boolean);
	const defaultOrigins = [
		"http://localhost:5173", // Vite dev
		"http://localhost", // Browser default for localhost
		"http://localhost:80", // Nginx in Docker
		"http://localhost:8000", // Api Gatewway
	];
	const allowList = envOrigins && envOrigins.length ? envOrigins : defaultOrigins;

	return {
		origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
			// Allow server-to-server requests (origin is undefined)
			if (!origin) return cb(null, true);
			// Check if the incoming origin is on the slist
			if (allowList.includes(origin)) return cb(null, true);

			// If not, block it
			console.warn("[CORS] Blocked origin:", origin, "Allowed list:", allowList);
			cb(new Error("Not allowed by CORS"));
		},
		credentials: true as const,
	};
}

export const corsOptions = buildCorsOptions();
