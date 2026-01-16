import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { CommandBus } from "../application/common/buses/command.bus";
import { LogRequestCommand } from "../application/commands/admin/logRequest/logRequest.command";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
	const startTime = Date.now();

	res.on("finish", async () => {
		try {
			const responseTimeMs = Date.now() - startTime;
			const userId = (req as any).decodedUser?.publicId;
			const userAgent = req.get("user-agent");

			const commandBus = container.resolve<CommandBus>("CommandBus");

			const command = new LogRequestCommand({
				method: req.method,
				route: req.originalUrl || req.url,
				ip: req.ip || req.socket.remoteAddress || "unknown",
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
