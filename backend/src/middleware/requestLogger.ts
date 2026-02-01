import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { CommandBus } from "@/application/common/buses/command.bus";
import { LogRequestCommand } from "@/application/commands/admin/logRequest/logRequest.command";
import net from "net"; // Built-in Node module

const getClientIp = (req: Request): string => {
	// This header has now traveled: Cloudflare -> Caddy -> Gateway -> Backend
	const cfIp = req.headers["cf-connecting-ip"];
	if (typeof cfIp === "string") return cfIp.trim();

	// Fallback if header is missing
	return req.ip || "unknown";
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
			const email = (req as any).decodedUser?.email;
			const userAgent = req.get("user-agent");

			const commandBus = container.resolve<CommandBus>("CommandBus");

			const command = new LogRequestCommand({
				method: req.method,
				route,
				ip: getClientIp(req),
				statusCode: res.statusCode,
				responseTimeMs,
				userId,
				email,
				userAgent,
			});

			await commandBus.dispatch(command);
		} catch (error) {
			console.error("Failed to log request:", error);
		}
	});

	next();
};
