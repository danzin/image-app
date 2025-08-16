import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { createError } from "../utils/errors";
import rateLimit from "express-rate-limit";

declare global {
	namespace Express {
		interface Request {
			decodedUser?: JwtPayload;
			adminContext?: {
				adminId: string;
				adminUsername: string;
				timestamp: Date;
				ip?: string;
				userAgent?: string;
			};
		}
	}
}

export abstract class AuthStrategy {
	abstract authenticate(req: Request): Promise<JwtPayload>;
}

export class BearerTokenStrategy extends AuthStrategy {
	constructor(private secret: string) {
		super();
	}

	async authenticate(req: Request): Promise<JwtPayload> {
		// Prefer secure httpOnly cookie but fall back to Authorization header if present
		let token: string | undefined = req.cookies?.token;
		if (!token) {
			// Some proxies may strip cookie; log incoming headers for diagnostics in dev
			if (process.env.NODE_ENV !== "production") {
				console.log("[AUTH][DEBUG] No token cookie. Incoming headers:", req.headers);
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
			const user = jwt.verify(token, this.secret) as JwtPayload;
			console.log(`[AUTH] User from token: ${JSON.stringify(user)}`);
			return user;
		} catch (err) {
			console.error("[AUTH] Token verification failed", (err as Error).message);
			throw createError("AuthenticationError", "Invalid or expired token");
		}
	}
}

export class AuthenticationMiddleware {
	constructor(private strategy: AuthStrategy) {}

	handle(): RequestHandler {
		return async (req: Request, _res: Response, next: NextFunction) => {
			try {
				req.decodedUser = await this.strategy.authenticate(req);
				console.log(`[AUTH] User authenticated: ${JSON.stringify(req.decodedUser)}`);
				next();
			} catch (error) {
				// Preserve original AppError (with statusCode) if present
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

// Enhanced admin-only middleware (requires authentication first)
export const enhancedAdminOnly = async (req: Request, res: Response, next: NextFunction) => {
	try {
		const user = req.decodedUser;

		// Check authentication (should already be done by auth middleware)
		if (!user) {
			console.warn(`[SECURITY] Unauthenticated admin access attempt from IP: ${req.ip}`);
			return res.status(401).json({ error: "Authentication required" });
		}

		// Check admin privileges
		if (!user.isAdmin) {
			console.warn(
				`[SECURITY] Unauthorized admin access attempt by user ${user.username} (${user.publicId}) from IP ${req.ip}`
			);
			return res.status(403).json({ error: "Admin privileges required" });
		}

		// Check if user is banned
		if (user.isBanned) {
			console.warn(`[SECURITY] Banned admin ${user.username} attempted access from IP ${req.ip}`);
			return res.status(403).json({ error: "Account banned" });
		}

		console.log(
			`[ADMIN_AUDIT] ${user.username} (${user.publicId}) performing ${req.method} ${req.path} from IP ${req.ip}`
		);

		// Add admin context to request
		req.adminContext = {
			adminId: user.publicId,
			adminUsername: user.username,
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
}
