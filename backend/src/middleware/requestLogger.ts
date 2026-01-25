import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { CommandBus } from "../application/common/buses/command.bus";
import { LogRequestCommand } from "../application/commands/admin/logRequest/logRequest.command";
import net from "net"; // Built-in Node module

const getClientIp = (req: Request): string => {
	// Priority is Cloudflare (the real user IP)
	const cfIp = req.headers["cf-connecting-ip"];
	if (typeof cfIp === "string" && cfIp) return cfIp.trim();

	// Priority is True-Client-IP (alternative Cloudflare header)
	const trueIp = req.headers["true-client-ip"];
	if (typeof trueIp === "string" && trueIp) return trueIp.trim();

	// Priority is X-Forwarded-For (standard proxy chain)
	// The first IP in the list is the original client
	const forwarded = req.headers["x-forwarded-for"];
	if (typeof forwarded === "string" && forwarded) {
		const ips = forwarded.split(",").map((ip) => ip.trim());
		// Return the first valid non-private IP or just the first one
		return ips[0];
	}

	// Fallback to direct socket IP
	const socketIp = req.socket.remoteAddress || req.ip || "unknown";

	// Clean up Docker's IPv6-mapped-IPv4 addresses (e.g., ::ffff:127.0.0.1 -> 127.0.0.1)
	if (net.isIPv6(socketIp) && socketIp.includes("::ffff:")) {
		return socketIp.replace("::ffff:", "");
	}

	return socketIp;
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
	const startTime = Date.now();

	res.on("finish", async () => {
		try {
			const route = req.originalUrl || req.url;

			if (route === "/health" || route === "/metrics") {
				return;
			}

			const responseTimeMs = Date.now() - startTime;
			const userId = (req as any).decodedUser?.publicId;
			const userAgent = req.get("user-agent");

			const commandBus = container.resolve<CommandBus>("CommandBus");

			// Get the IP using the improved logic
			const ip = getClientIp(req);

			const command = new LogRequestCommand({
				method: req.method,
				route,
				ip,
				statusCode: res.statusCode,
				responseTimeMs,
				userId,
				userAgent,
			});

			await commandBus.dispatch(command);
		} catch (error) {
			console.error("Failed to log request:", error);
		}
	});

	next();
};
