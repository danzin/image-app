import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { CommandBus } from "../application/common/buses/command.bus";
import { LogRequestCommand } from "../application/commands/admin/logRequest/logRequest.command";

const extractIpv4 = (value: string): string | undefined => {
	const trimmed = value.trim();
	const mappedMatch = trimmed.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})/i);
	if (mappedMatch?.[1]) {
		return mappedMatch[1];
	}

	const ipv4Match = trimmed.match(/\b(\d{1,3}(?:\.\d{1,3}){3})\b/);
	return ipv4Match?.[1];
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
		const forwardedIps = xForwardedFor.split(",").map((ip) => ip.trim());
		const ipv4FromForwarded = forwardedIps.map((ip) => extractIpv4(ip)).find((ip) => ip !== undefined);
		return ipv4FromForwarded || forwardedIps[0];
	}

	const directIp = req.ip || req.socket.remoteAddress;
	if (directIp) {
		return extractIpv4(directIp) || directIp;
	}

	return "unknown";
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
