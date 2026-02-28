import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { CommandBus } from "@/application/common/buses/command.bus";
import { LogRequestCommand } from "@/application/commands/admin/logRequest/logRequest.command";

const stripPort = (raw: string): string => {
	const trimmed = raw.trim();
	if (trimmed.startsWith("[")) return trimmed; // dont touch IPv6
	const lastColon = trimmed.lastIndexOf(":");
	if (lastColon === -1) return trimmed;
	// Only strip if the part after the colon is a valid port number
	const maybePart = trimmed.slice(lastColon + 1);
	if (/^\d{1,5}$/.test(maybePart)) return trimmed.slice(0, lastColon);
	return trimmed;
};

const getClientIp = (req: Request): string => {
	// CF-Connecting-IP: Cloudflare sets it. Real visitor IP
	const cfIp = req.headers["cf-connecting-ip"];
	if (typeof cfIp === "string" && cfIp.trim()) return stripPort(cfIp);

	// X-Real-IP: This one is set by Caddy/Ngninx.
	const xRealIp = req.headers["x-real-ip"];
	if (typeof xRealIp === "string" && xRealIp.trim()) return stripPort(xRealIp);

	// X-Forwarded-For: First entry is the original client
	const xff = req.headers["x-forwarded-for"];
	if (typeof xff === "string" && xff.trim()) return stripPort(xff.split(",")[0]);

	return stripPort(req.ip || "unknown");
};

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
	const startTime = Date.now();

	res.on("finish", async () => {
		try {
			const route = (req.originalUrl || req.url).split("?")[0];

			if (route === "/health" || route.startsWith("/metrics") || route.startsWith("/telemetry")) {
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
			console.error("Failed to log request:", error);
		}
	});

	next();
};
