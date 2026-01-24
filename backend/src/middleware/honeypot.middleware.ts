import { Request, Response, NextFunction } from "express";
import { logger } from "../utils/winston";

export const honeypotMiddleware = (req: Request, res: Response, next: NextFunction) => {
	const website = typeof req.body?.website === "string" ? req.body.website.trim() : "";
	if (website) {
		logger.warn("[HONEYPOT] Triggered", {
			ip: req.ip,
			path: req.originalUrl,
		});

		return res.status(200).json({ message: "ok" });
	}

	return next();
};
