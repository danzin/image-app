import { Request, Response, NextFunction } from "express";
import { behaviourLogger, detailedRequestLogger } from "@/utils/winston";
declare module "express-serve-static-core" {
	interface Request {
		_startTime: number;
	}
}

// Middleware for logging behavior
export const logBehaviour = (req: Request, res: Response, next: NextFunction) => {
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

/** Strip port suffix from IP (e.g. "1.2.3.4:10150" → "1.2.3.4") */
const stripPort = (raw: string): string => {
	const trimmed = raw.trim();
	if (trimmed.startsWith("[")) return trimmed;
	const lastColon = trimmed.lastIndexOf(":");
	if (lastColon === -1) return trimmed;
	const maybePart = trimmed.slice(lastColon + 1);
	if (/^\d{1,5}$/.test(maybePart)) return trimmed.slice(0, lastColon);
	return trimmed;
};

const getClientIp = (req: Request): string => {
	const cfConnectingIp = req.headers["cf-connecting-ip"];
	if (typeof cfConnectingIp === "string" && cfConnectingIp.trim()) {
		return stripPort(cfConnectingIp);
	}

	const trueClientIp = req.headers["true-client-ip"];
	if (typeof trueClientIp === "string" && trueClientIp.trim()) {
		return stripPort(trueClientIp);
	}

	const xRealIp = req.headers["x-real-ip"];
	if (typeof xRealIp === "string" && xRealIp.trim()) {
		return stripPort(xRealIp);
	}

	const xForwardedFor = req.headers["x-forwarded-for"];
	if (typeof xForwardedFor === "string" && xForwardedFor.trim()) {
		return stripPort(xForwardedFor.split(",")[0]);
	}

	return stripPort(req.ip || req.socket.remoteAddress || "unknown");
};

export const detailedRequestLogging = (req: Request, res: Response, next: NextFunction) => {
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
