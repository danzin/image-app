// Build CORS options dynamically. Accept comma separated ALLOWED_ORIGINS or fallback list.
export function buildCorsOptions() {
	const envOrigins = process.env.ALLOWED_ORIGINS?.split(/[,\s]+/).filter(Boolean);
	const defaultOrigins = [
		"http://localhost:5173", // Vite dev
		"http://localhost", // Nginx frontend at port 80
		"http://localhost:80",
		"http://localhost:8000", // Gateway
	];
	const allowList = envOrigins && envOrigins.length ? envOrigins : defaultOrigins;

	return {
		origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
			if (!origin) return cb(null, true); // non-browser (curl, server-to-server)
			if (allowList.includes(origin)) return cb(null, true);
			console.warn("[CORS] Blocked origin:", origin, "allowed:", allowList);
			cb(null, false);
		},
		credentials: true as const,
	};
}

export const corsOptions = buildCorsOptions();
