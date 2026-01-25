import { Request, Response, NextFunction } from "express";
import { behaviourLogger, detailedRequestLogger } from "../utils/winston";
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
	const logObject = {
		method: req.method,
		url: req.url,
		params: req.params,
		query: req.query,
		body: req.body,
		headers: req.headers,
		decodedUser: req?.decodedUser || {},
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
