import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { CommandBus } from "../application/common/buses/command.bus";
import { LogRequestCommand } from "../application/commands/admin/logRequest/logRequest.command";

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

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
	const startTime = Date.now();

	res.on("finish", async () => {
		try {
			const route = req.originalUrl || req.url;

			// skip logging for health and metrics endpoints
			if (route === "/health" || route === "/metrics") {
				return;
			}

			const responseTimeMs = Date.now() - startTime;
			const userId = (req as any).decodedUser?.publicId;
			const userAgent = req.get("user-agent");

			const commandBus = container.resolve<CommandBus>("CommandBus");

			const command = new LogRequestCommand({
				method: req.method,
				route,
				ip: getClientIp(req),
				statusCode: res.statusCode,
				responseTimeMs,
				userId,
				userAgent,
			});

			await commandBus.dispatch(command);
		} catch (error) {
			// silently fail - don't break the request flow if logging fails
			console.error("Failed to log request:", error);
		}
	});

	next();
};
