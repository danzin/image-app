import { IncomingMessage, ServerResponse } from "http";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import { config } from "./config";

interface ExtendedProxyOptions
  extends Options<IncomingMessage, ServerResponse> {
  onProxyReq?: (proxyReq: any, req: Request, res: Response) => void;
  onProxyRes?: (proxyRes: any, req: Request, res: Response) => void;
  onError?: (err: Error, req: Request, res: Response) => void;
  logLevel?: string;
  logProvider?: (provider: any) => any;
}

const app = express();
app.set("trust proxy", 1); // Trust the first hop (Nginx)

// Allow requests from frontend
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:80",
      "http://localhost",
    ],
    credentials: true,
  })
);

// Global incoming log
app.use((req, res, next) => {
  console.log(
    `[Gateway] Incoming Request: ${req.method} ${req.originalUrl} from IP: ${req.ip}`
  );
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 10000,
  max: 15000,
  message: "Too many requests, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Shared proxy options
const proxyOptions: ExtendedProxyOptions = {
  target: config.backendUrl,
  changeOrigin: true,
  ws: true,
  logLevel: "debug",
  onProxyReq: (proxyReq, req) => {
    // Log the actual path forwarded
    console.log(
      `[Gateway] Proxying ${req.method} ${req.originalUrl} -> ${config.backendUrl}${proxyReq.path}`
    );
    proxyReq.setHeader("X-Forwarded-By", "api-gateway");
  },
  onProxyRes: (proxyRes, req) => {
    console.log(
      `[Gateway] Response ${proxyRes.statusCode} for ${req.originalUrl}`
    );
  },
  onError: (err, req, res) => {
    console.error("[Gateway] Proxy error:", err.message, {
      url: req.originalUrl,
    });
    if (!res.headersSent) {
      res.status(502).send("Bad Gateway");
    } else if (!res.writableEnded) {
      res.end();
    }
  },
};
app.use((req, res, next) => {
  console.log(`[Gateway] Incoming: ${req.method} ${req.originalUrl}`);
  console.log(`[Gateway] req.ip: ${req.ip}`); // what Express resolves as client IP
  console.log(
    `[Gateway] X-Forwarded-For Header: ${req.headers["x-forwarded-for"]}`
  );
  console.log(`[Gateway] trust proxy setting: ${app.get("trust proxy")}`); // verify the setting
  next();
});

// Proxy /api
console.log(`[Gateway] Proxy /api -> ${config.backendUrl}`);
app.use("/api", createProxyMiddleware(proxyOptions));

// Proxy /uploads with pathRewrite to preserve the prefix
console.log(`[Gateway] Proxy /uploads -> ${config.backendUrl}`);
app.use(
  "/uploads",
  createProxyMiddleware({
    ...proxyOptions,
    pathRewrite: {
      // match the entire url and rewrite to include /uploads
      "^/": "/uploads/",
    },
  })
);

// Health check
app.get("/", (_req, res) => res.send("API Gateway is running"));

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
app.listen(config.port, () => {
  console.log(`Gateway listening on port ${config.port}`);
  console.log(`Forwarding to backend at ${config.backendUrl}`);
});
