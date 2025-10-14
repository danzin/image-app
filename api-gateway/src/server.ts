import { IncomingMessage } from "http";
import { Socket } from "net";
import http from "http";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import { config } from "./config.js";

const app = express();
app.set("trust proxy", 1); // Trust the first hop (Nginx)

const allowedOrigins = [
	"http://localhost:5173", // Vite dev
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
		proxyReq: (proxyReq, req, res) => {
			const origin = (req as Request).headers.origin;
			console.log(`[Gateway] Proxying ${(req as Request).method} ${(req as Request).originalUrl} | Origin: ${origin}`);
		},
		proxyRes: (proxyRes, req, res) => {
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
					} | Origin: ${origin}`
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
	console.log(`[Gateway] Incoming Request: ${req.method} ${req.originalUrl} from IP: ${req.ip}`);
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
app.use("/api", apiProxy);

// Proxy socket.io (websocket + polling) traffic explicitly to backend so frontend can target gateway host
console.log(`[Gateway] Proxy /socket.io -> ${config.backendUrl}`);
app.use("/socket.io", apiProxy);

// Health check

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
