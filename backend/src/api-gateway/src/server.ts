import "reflect-metadata";
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

// Allow reqs from the frontend
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// Log
app.use((req, res, next) => {
  console.log(
    `[Gateway] Incoming Request: ${req.method} ${req.originalUrl} from ${req.ip}`
  );
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit IPs to 100 requests per `windowMs`
  message: "You're making too many requests, please try again after 15 minutes",
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

app.use((req, res, next) => {
  console.log(`[Gateway] Incoming Request: ${req.method} ${req.originalUrl}`);
  next();
});

// --- Proxy Setup ---

const proxyOptions: ExtendedProxyOptions = {
  target: config.backendUrl,
  changeOrigin: true,
  ws: true,
  logLevel: "debug",
  onProxyReq: (proxyReq: any, req: Request, res: Response) => {
    proxyReq.setHeader("X-Forwarded-By", "api-gateway");
    console.log(
      `[Gateway] Proxying to target: ${config.backendUrl}${proxyReq.path}`
    );
    console.log(
      `[Gateway] >> Request Headers:`,
      JSON.stringify(proxyReq.getHeaders(), null, 2)
    );
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(
      `[Gateway] << Response Status: ${proxyRes.statusCode} for ${req.originalUrl}`
    );
    console.log(
      `[Gateway] << Response Headers:`,
      JSON.stringify(proxyRes.headers, null, 2)
    );
  },
  onError: (err, req, res) => {
    console.error("[Gateway] Proxy error:", err.message, {
      url: req.originalUrl,
      method: req.method,
      target: config.backendUrl,
    });
    if (res && !res.headersSent) {
      if (typeof (res as any).status === "function") {
        (res as Response).status(502).send("Bad Gateway");
      } else {
        res.writeHead(502);
        res.end("Bad Gateway");
      }
    } else if (res && !res.writableEnded) {
      res.end();
    }
  },
};

// --- Route-Specific Proxying ---
console.log(`[Gateway] Setting up proxy for /api to ${config.backendUrl}`);
app.use("/api", createProxyMiddleware(proxyOptions));

console.log(`[Gateway] Setting up proxy for /uploads to ${config.backendUrl}`);
app.use(
  "/uploads",
  createProxyMiddleware({
    ...proxyOptions,
    pathRewrite: {
      "^/uploads": "/uploads",
    },
  })
);

app.get("/", (req, res) => {
  res.send("API Gateway is running");
});

// --- Error Handling Middleware (Gateway Level) ---
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("[Gateway] Internal Error:", err.stack);
  if (!res.headersSent) {
    res.status(500).send("Internal Server Error");
  } else {
    next(err); // Delegate if headers already sent
  }
});

// --- Start Server ---
app.listen(config.port, () => {
  console.log(`API Gateway listening on port ${config.port}`);
  console.log(`Proxying requests to: ${config.backendUrl}`);
});
