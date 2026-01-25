import { IncomingMessage } from "http";
import net, { Socket } from "net";
import http from "http";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "./config.js";
import client from "prom-client";

const app = express();
const metricsRegistry = new client.Registry();
metricsRegistry.setDefaultLabels({ service: "api-gateway" });
client.collectDefaultMetrics({ register: metricsRegistry, eventLoopMonitoringPrecision: 10 });
const envAllowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

const httpDuration = new client.Histogram({
	name: "gateway_http_request_duration_seconds",
	help: "Gateway HTTP request latency",
	labelNames: ["method", "route", "status"],
	buckets: [0.05, 0.1, 0.2, 0.5, 1, 2, 5],
	registers: [metricsRegistry],
});

const httpRequestsTotal = new client.Counter({
	name: "gateway_http_requests_total",
	help: "Gateway HTTP request total",
	labelNames: ["method", "route", "status"],
	registers: [metricsRegistry],
});

const allowedApiPrefixes = [
	"/users",
	"/images",
	"/posts",
	"/search",
	"/admin",
	"/notifications",
	"/feed",
	"/favorites",
	"/messaging",
	"/communities",
	"/telemetry",
	"/metrics",
	"/health",
];

const getClientIp = (req: Request): string => {
	// If Cloudflare Pseudo IPv4 is done, this header contains the IPv4
	const cfIp = req.headers["cf-connecting-ip"];
	if (typeof cfIp === "string" && cfIp) return cfIp.trim();

	return req.ip || "unknown";
};

app.set("trust proxy", true); // Trust the Nginx proxy (loopback) and Cloudflare

const allowedOrigins = [
	...envAllowedOrigins,
	"http://localhost:5173", // Vite dev
	"http://localhost:5174", // Vite dev alternate port
	"http://localhost:80", // Nginx in Docker
	"http://localhost", // Browser default for localhost
];

const corsOptions: cors.CorsOptions = {
	origin: (origin, callback) => {
		// Allow requests with no origin (curl, Postman, or server-to-server)
		if (!origin) {
			return callback(null, true);
		}

		// Check if the origin is in thje allowed list
		if (allowedOrigins.includes(origin)) {
			return callback(null, origin); // Return the specific origin
		}

		// Block all other origins
		console.warn("[Gateway CORS] Blocked origin:", origin);
		callback(new Error("Request from this origin is blocked by CORS policy"));
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
	exposedHeaders: ["Set-Cookie"],
	maxAge: 86400, // 24 hours
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

const normalizeRoute = (req: Request): string => {
	const base = req.baseUrl || "";
	const route = req.route?.path ? `${base}${req.route.path}` : req.originalUrl.split("?")[0] || "/";
	return route.replace(/[0-9a-fA-F]{8,}/g, ":id").replace(/\d+/g, ":id");
};

app.use((req, res, next) => {
	const stopTimer = httpDuration.startTimer();
	res.once("finish", () => {
		const route = normalizeRoute(req);
		const status = String(res.statusCode);
		httpRequestsTotal.labels(req.method, route, status).inc();
		stopTimer({ method: req.method, route, status });
	});
	next();
});

app.get("/metrics", async (_req: Request, res: Response) => {
	res.setHeader("Content-Type", metricsRegistry.contentType);
	res.end(await metricsRegistry.metrics());
});

// Rate Limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 10000,
	max: 15000,
	message: "Too many requests, please try again after 15 minutes",
	standardHeaders: true,
	legacyHeaders: false,
});

const apiProxy = createProxyMiddleware({
	target: config.backendUrl,
	changeOrigin: true,
	ws: true,
	pathRewrite: (path) => (path.startsWith("/api") ? path.replace("/api", "") : path),
	on: {
		proxyReq: (proxyReq, req, _res) => {
			const cfIp = (req as Request).headers["cf-connecting-ip"];
			if (typeof cfIp === "string") {
				proxyReq.setHeader("CF-Connecting-IP", cfIp);
				proxyReq.setHeader("X-Real-IP", cfIp);
			}
			const origin = (req as Request).headers.origin;
			console.log(`[Gateway] Proxying ${(req as Request).method} ${(req as Request).originalUrl} | Origin: ${origin}`);
		},
		proxyRes: (proxyRes, req, _res) => {
			const origin = (req as Request).headers.origin;

			if (origin && allowedOrigins.includes(origin)) {
				proxyRes.headers["access-control-allow-origin"] = origin;
				proxyRes.headers["access-control-allow-credentials"] = "true";
				proxyRes.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, PATCH, OPTIONS";
				proxyRes.headers["access-control-allow-headers"] = "Content-Type, Authorization, X-Requested-With";
				proxyRes.headers["access-control-expose-headers"] = "Set-Cookie";

				console.log(
					`[Gateway] Added CORS headers for ${(req as Request).originalUrl} | Status: ${
						proxyRes.statusCode
					} | Origin: ${origin}`,
				);
			} else if (origin) {
				console.warn(`[Gateway] Origin not in allowed list: ${origin}`);
			}

			console.log(`[Gateway] Response ${proxyRes.statusCode} for ${(req as Request).originalUrl}`);
		},
		error: (err, req, res) => {
			console.error("[Gateway] Proxy Error:", err);
			// Check if the response object is an HTTP response before sending a status
			if (res instanceof http.ServerResponse && !res.headersSent) {
				res.writeHead(504, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ error: "Gateway Timeout" }));
			}
		},
	},
});

// Add health check endpoint for API Gateway
app.get("/health", (req, res) => {
	res.status(200).json({
		status: "ok",
		timestamp: new Date().toISOString(),
		service: "api-gateway",
	});
});

// Global incoming log
app.use((req, res, next) => {
	console.log(`[Gateway] Incoming Request: ${req.method} ${req.originalUrl} from IP: ${getClientIp(req)}`);
	next();
});

app.use(limiter);

console.log(`[Gateway] Proxy /uploads -> ${config.backendUrl}/uploads`);
app.use("/uploads", (req, res, next) => {
	req.url = "/uploads" + req.url;
	apiProxy(req, res, next);
});

// Proxy /api
console.log(`[Gateway] Proxy /api -> ${config.backendUrl}`);
app.use("/api", (req, res, next) => {
	const requestPath = req.path || "/";
	const isAllowed = allowedApiPrefixes.some((prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`));

	if (!isAllowed) {
		res.status(404).json({
			error: "Route not found",
			method: req.method,
			path: req.originalUrl,
		});
		return;
	}

	apiProxy(req, res, next);
});

// Proxy socket.io (websocket + polling) traffic explicitly to backend so frontend can target gateway host
console.log(`[Gateway] Proxy /socket.io -> ${config.backendUrl}`);
app.use("/socket.io", apiProxy);

app.use((req, res) => {
	res.status(404).json({
		error: "Route not found",
		method: req.method,
		path: req.originalUrl,
	});
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
	console.error("[Gateway] Internal error:", err.stack);
	if (!res.headersSent) {
		res.status(500).send("Internal Server Error");
	} else {
		next(err);
	}
});

// Start
const server = http.createServer(app);

server.listen(config.port, () => {
	console.log(` Gateway listening on port ${config.port}`);
});

server.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
	console.log(`[Gateway] Handling upgrade request for: ${req.url}`);
	console.log(`[Gateway] Upgrade origin: ${req.headers.origin}`);

	// Validate origin for WebSocket upgrade
	const origin = req.headers.origin;
	if (origin && !allowedOrigins.includes(origin)) {
		console.warn(`[Gateway] Blocked WebSocket upgrade from origin: ${origin}`);
		socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
		socket.destroy();
		return;
	}

	apiProxy.upgrade?.(req, socket, head);
});
