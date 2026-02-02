import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { container } from "tsyringe";
import { createError } from "@/utils/errors";
import rateLimit from "express-rate-limit";
import { DecodedUser, AdminContext } from "@/types";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { logger } from "@/utils/winston";

declare global {
	namespace Express {
		interface Request {
			decodedUser?: DecodedUser;
			adminContext?: AdminContext;
		}
	}
}

export abstract class AuthStrategy {
	abstract authenticate(req: Request): Promise<DecodedUser>;
}

export class BearerTokenStrategy extends AuthStrategy {
	constructor(private secret: string) {
		super();
	}

	async authenticate(req: Request): Promise<DecodedUser> {
		// Prefer secure httpOnly cookie but fall back to Authorization header if present
		let token: string | undefined = req.cookies?.token;
		if (!token) {
			// Some proxies may strip cookie; log incoming headers for diagnostics in dev
			if (process.env.NODE_ENV !== "production") {
				logger.info("[AUTH][DEBUG] No token cookie. Incoming headers:", req.headers);
			}
		}
		if (!token) {
			const authHeader = req.headers.authorization;
			if (authHeader && authHeader.startsWith("Bearer ")) {
				token = authHeader.substring(7);
			}
		}
		if (!token) {
			console.warn(`[AUTH] Missing token for ${req.method} ${req.originalUrl}`);
			throw createError("AuthenticationError", "Missing token");
		}
		try {
			const payload = jwt.verify(token, this.secret) as DecodedUser;

			if (!payload.publicId || !payload.email || !payload.username || !payload.handle) {
				throw createError("AuthenticationError", "Invalid token payload");
			}

			logger.info(`[AUTH] User from token: ${payload.username} (${payload.publicId})`);
			return payload;
		} catch (err) {
			console.error("[AUTH] Token verification failed", (err as Error).message);
			throw createError("AuthenticationError", "Invalid or expired token");
		}
	}
}

export class AuthenticationMiddleware {
	constructor(private strategy: AuthStrategy) {}

	private async enforceVerifiedEmail(decodedUser: DecodedUser): Promise<void> {
		const userReadRepository = container.resolve<IUserReadRepository>("UserReadRepository");
		const user = await userReadRepository.findByPublicId(decodedUser.publicId);

		if (!user) {
			throw createError("AuthenticationError", "User not found");
		}

		if (user.isEmailVerified === false) {
			throw createError("ForbiddenError", "Email verification required");
		}
	}

	handle(): RequestHandler {
		return async (req: Request, _res: Response, next: NextFunction) => {
			try {
				req.decodedUser = await this.strategy.authenticate(req);
				await this.enforceVerifiedEmail(req.decodedUser);
				logger.info(`[AUTH] User authenticated: ${req.decodedUser.username} (${req.decodedUser.publicId})`);
				next();
			} catch (error) {
				// Preserve original AppError Wwith statusCode
				if (
					typeof error === "object" &&
					error !== null &&
					"name" in error &&
					"message" in error &&
					"statusCode" in (error as any)
				) {
					return next(error as any);
				}
				const message =
					typeof error === "object" && error !== null && "message" in error
						? (error as { message?: string }).message || "Unauthorized"
						: "Unauthorized";
				// Default missing/other errors to AuthenticationError (401)
				next(createError("AuthenticationError", message));
			}
		};
	}

	/**
	 * Optional authentication - sets req.decodedUser if token is present and valid,
	 * but doesn't throw an error if token is missing or invalid
	 */
	handleOptional(): RequestHandler {
		return async (req: Request, _res: Response, next: NextFunction) => {
			try {
				req.decodedUser = await this.strategy.authenticate(req);
				await this.enforceVerifiedEmail(req.decodedUser);
				logger.info(`[AUTH] Optional auth - User authenticated: ${req.decodedUser.username}`);
			} catch {
				// Silently fail for optional authentication
				req.decodedUser = undefined;
			}
			next();
		};
	}
}

// Admin-specific rate limiting
export const adminRateLimit = rateLimit({
	windowMs: 5 * 60 * 1000, // 5 minutes
	max: 50, // 50 admin actions per 5 minutes
	message: "Too many admin actions, please slow down",
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => `admin-${req.decodedUser?.publicId || req.ip}`,
});

export const forgotPasswordIpRateLimit = rateLimit({
	windowMs: Number(process.env.FORGOT_PASSWORD_IP_WINDOW_MS) || 15 * 60 * 1000,
	max: Number(process.env.FORGOT_PASSWORD_IP_MAX) || 5,
	message: "Too many password reset requests, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => `forgot-password-ip:${req.ip}`,
});

export const forgotPasswordEmailRateLimit = rateLimit({
	windowMs: Number(process.env.FORGOT_PASSWORD_EMAIL_WINDOW_MS) || 60 * 60 * 1000,
	max: Number(process.env.FORGOT_PASSWORD_EMAIL_MAX) || 3,
	message: "Too many password reset requests, please try again later",
	standardHeaders: true,
	legacyHeaders: false,
	keyGenerator: (req) => {
		const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
		return `forgot-password-email:${email || "unknown"}`;
	},
});

// Enhanced admin-only middleware (requires authentication first)
export const enhancedAdminOnly = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const decodedUser = req.decodedUser;

		// Check authentication (should already be done by auth middleware)
		if (!decodedUser) {
			console.warn(`[SECURITY] Unauthenticated admin access attempt from IP: ${req.ip}`);
			return res.status(401).json({ error: "Authentication required" });
		}

		// Check admin privileges from JWT
		if (!decodedUser.isAdmin) {
			console.warn(
				`[SECURITY] Unauthorized admin access attempt by user ${decodedUser.username} (${decodedUser.publicId}) from IP ${req.ip}`,
			);
			return res.status(403).json({ error: "Admin privileges required" });
		}

		// Fetch fresh user data from DB to check current ban status
		// JWT may have been issued before user was banned
		const userReadRepository = container.resolve<IUserReadRepository>("UserReadRepository");
		const user = await userReadRepository.findByPublicId(decodedUser.publicId);

		if (!user) {
			console.warn(`[SECURITY] Admin user ${decodedUser.publicId} not found in database`);
			return res.status(401).json({ error: "User not found" });
		}

		// Check if user is banned (from fresh DB data)
		if (user.isBanned) {
			console.warn(`[SECURITY] Banned admin ${decodedUser.username} attempted access from IP ${req.ip}`);
			return res.status(403).json({ error: "Account banned" });
		}

		// Verify admin status from DB as well (in case JWT was issued before admin revocation)
		if (!user.isAdmin) {
			console.warn(`[SECURITY] User ${decodedUser.username} has admin JWT but is no longer admin in DB`);
			return res.status(403).json({ error: "Admin privileges required" });
		}

		const adminEmailsEnv = process.env.ADMIN_EMAILS;
		if (adminEmailsEnv) {
			const allowedEmails = adminEmailsEnv
				.split(",")
				.map((e) => e.trim().toLowerCase())
				.filter((e) => e.length > 0);

			if (user.email && !allowedEmails.includes(user.email.toLowerCase())) {
				console.warn(
					`[SECURITY] Admin access denied for ${user.email} (not in ADMIN_EMAILS allowlist) from IP ${req.ip}`,
				);
				return res.status(403).json({ error: "Admin privileges restricted" });
			}
		}

		logger.info(
			`[ADMIN_AUDIT] ${decodedUser.username} (${decodedUser.publicId}) performing ${req.method} ${req.path} from IP ${req.ip}`,
		);

		// Add admin context to request
		req.adminContext = {
			adminId: decodedUser.publicId,
			adminUsername: decodedUser.username,
			timestamp: new Date(),
			ip: req.ip,
			userAgent: req.get("User-Agent"),
		};

		next();
	} catch (error) {
		console.error("[ADMIN_SECURITY] Admin middleware error:", error);
		return res.status(500).json({ error: "Internal server error" });
	}
};

// Admin action validation middleware
export const adminActionValidation = (requiredFields: string[] = []) => {
	return (req: Request, res: Response, next: NextFunction) => {
		// Validate required fields
		for (const field of requiredFields) {
			if (!req.body[field]) {
				return res.status(400).json({
					error: `Missing required field: ${field}`,
					requiredFields,
				});
			}
		}

		// Validate publicId format in params
		if (
			req.params.publicId &&
			!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.publicId)
		) {
			return res.status(400).json({ error: "Invalid publicId format" });
		}

		next();
	};
};

// Factory for common authentication types
export class AuthFactory {
	static bearerToken(): AuthenticationMiddleware {
		const secret = process.env.JWT_SECRET;
		if (!secret) throw new Error("JWT_SECRET not configured");

		return new AuthenticationMiddleware(new BearerTokenStrategy(secret));
	}

	static optionalBearerToken(): AuthenticationMiddleware {
		const secret = process.env.JWT_SECRET;
		if (!secret) throw new Error("JWT_SECRET not configured");

		return new AuthenticationMiddleware(new BearerTokenStrategy(secret));
	}
}
