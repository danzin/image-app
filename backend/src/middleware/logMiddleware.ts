import { Request, Response, NextFunction } from "express";
import { behaviourLogger, detailedRequestLogger } from "@/utils/winston";
declare module "express-serve-static-core" {
	interface Request {
		_startTime: number;
	}
}

// Middleware for logging behavior
export const logBehaviour = (req: Request, res: Response, next: NextFunction) => {
	if (process.env.DISABLE_LOGS === "true") {
		return next();
	}
	const start = Date.now();
	const { method, url } = req;

	behaviourLogger.info(`Request started: ${method} ${url}`);

	res.on("finish", () => {
		const duration = Date.now() - start;
		const { statusCode } = res;
		behaviourLogger.info(`Request completed: ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms`);
	});

	next();
};

const getClientIp = (req: Request): string => {
	const cfConnectingIp = req.headers["cf-connecting-ip"];
	if (typeof cfConnectingIp === "string" && cfConnectingIp.trim()) {
		return cfConnectingIp.trim();
	}

	const trueClientIp = req.headers["true-client-ip"];
	if (typeof trueClientIp === "string" && trueClientIp.trim()) {
		return trueClientIp.trim();
	}

	const xRealIp = req.headers["x-real-ip"];
	if (typeof xRealIp === "string" && xRealIp.trim()) {
		return xRealIp.trim();
	}

	const xForwardedFor = req.headers["x-forwarded-for"];
	if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
		return xForwardedFor.split(",")[0].trim();
	}

	return req.ip || req.socket.remoteAddress || "unknown";
};

export const detailedRequestLogging = (req: Request, res: Response, next: NextFunction) => {
	if (process.env.DISABLE_LOGS === "true") {
		return next();
	}
	const logObject = {
		method: req.method,
		url: req.url.split("?")[0],
		params: Object.keys(req.params || {}).length > 0 ? req.params : undefined,
		query: Object.keys(req.query || {}).length > 0 ? req.query : undefined,
		ip: getClientIp(req),
		timestamp: new Date().toISOString(),
	};

	detailedRequestLogger.info("Detailed Request Log", logObject);

	res.on("finish", () => {
		detailedRequestLogger.info("Request completed", {
			method: req.method,
			url: req.url,
			status: res.statusCode,
			responseTime: Date.now() - req._startTime,
		});
	});

	next();
};
