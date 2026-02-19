import crypto from "crypto";
import jwt from "jsonwebtoken";
import { inject, injectable } from "tsyringe";
import { UserRepository } from "@/repositories/user.repository";
import { DTOService, AdminUserDTO, AuthenticatedUserDTO } from "@/services/dto.service";
import { createError } from "@/utils/errors";
import { DecodedUser, IUser } from "@/types";
import { AuthSessionService } from "@/services/auth-session.service";

export interface AuthSessionContext {
	ip?: string;
	userAgent?: string;
}

export interface AuthTokens {
	accessToken: string;
	refreshToken: string;
	sid: string;
}

export interface AuthenticatedSessionResult extends AuthTokens {
	user: AuthenticatedUserDTO | AdminUserDTO;
}

type SessionUser = Pick<DecodedUser, "publicId" | "email" | "handle" | "username" | "isAdmin">;

@injectable()
export class AuthService {
	private readonly accessTokenTtlSeconds = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 60 * 15;
	private readonly refreshTokenTtlSeconds = Number(process.env.REFRESH_TOKEN_TTL_SECONDS) || 60 * 60 * 24 * 30;

	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("AuthSessionService") private readonly authSessionService: AuthSessionService,
	) {}

	/**
	 * Authenticates a user and creates a server-backed session.
	 */
	async login(email: string, password: string, context: AuthSessionContext = {}): Promise<AuthenticatedSessionResult> {
		const user = await this.userRepository.findByEmail(email);
		if (!user || typeof user.comparePassword !== "function" || !(await user.comparePassword(password))) {
			throw createError("AuthenticationError", "Invalid email or password");
		}

		const userDTO = user.isAdmin ? this.dtoService.toAdminDTO(user) : this.dtoService.toAuthenticatedUserDTO(user);
		const tokens = await this.issueTokensForUser(this.toSessionUser(user), context);

		return { user: userDTO, ...tokens };
	}

	async issueTokensForUser(user: SessionUser, context: AuthSessionContext = {}): Promise<AuthTokens> {
		const { sid, refreshToken } = this.createRefreshToken();
		await this.authSessionService.createSession({
			sid,
			publicId: user.publicId,
			refreshToken,
			ttlSeconds: this.getRefreshTokenTtlSeconds(),
			ip: context.ip,
			userAgent: context.userAgent,
		});

		const accessToken = this.generateAccessToken(user, sid);
		return { accessToken, refreshToken, sid };
	}

	async refreshSession(refreshToken: string, context: AuthSessionContext = {}): Promise<AuthenticatedSessionResult> {
		const session = await this.authSessionService.validateRefreshToken(refreshToken);
		const user = await this.userRepository.findByPublicId(session.publicId);
		if (!user) {
			await this.authSessionService.revokeSession(session.sid);
			throw createError("AuthenticationError", "User not found");
		}

		const userDTO = user.isAdmin ? this.dtoService.toAdminDTO(user) : this.dtoService.toAuthenticatedUserDTO(user);
		const { refreshToken: nextRefreshToken } = this.createRefreshToken(session.sid);
		await this.authSessionService.rotateRefreshToken(
			session.sid,
			nextRefreshToken,
			this.getRefreshTokenTtlSeconds(),
			context,
		);

		const accessToken = this.generateAccessToken(this.toSessionUser(user), session.sid);
		return { user: userDTO, accessToken, refreshToken: nextRefreshToken, sid: session.sid };
	}

	async revokeSessionByRefreshToken(refreshToken: string): Promise<void> {
		const session = await this.authSessionService.validateRefreshToken(refreshToken);
		await this.authSessionService.revokeSession(session.sid);
	}

	async revokeSessionByAccessToken(accessToken: string): Promise<void> {
		const payload = this.verifyAccessToken(accessToken);
		if (!payload.sid) {
			throw createError("AuthenticationError", "Missing session identifier in access token");
		}
		await this.authSessionService.revokeSession(payload.sid);
	}

	async revokeAllSessionsForUser(publicId: string): Promise<void> {
		await this.authSessionService.revokeAllSessionsForUser(publicId);
	}

	private generateAccessToken(user: SessionUser, sid: string): string {
		const payload: DecodedUser = {
			publicId: user.publicId,
			email: user.email,
			handle: user.handle,
			username: user.username,
			isAdmin: user.isAdmin,
			sid,
			jti: crypto.randomUUID(),
			ver: 1,
		};

		return jwt.sign(payload, this.getJwtSecret(), { expiresIn: this.getAccessTokenTtlSeconds() });
	}

	private verifyAccessToken(token: string): DecodedUser {
		try {
			const decoded = jwt.verify(token, this.getJwtSecret());
			if (typeof decoded !== "object" || decoded === null) {
				throw createError("AuthenticationError", "Invalid access token");
			}
			return decoded as DecodedUser;
		} catch (error) {
			if (error instanceof Error && error.name === "TokenExpiredError") {
				throw createError("AuthenticationError", "Access token expired");
			}
			throw createError("AuthenticationError", "Invalid access token");
		}
	}

	private getJwtSecret(): string {
		const secret = process.env.JWT_SECRET;
		if (!secret) {
			throw createError("ConfigError", "JWT secret is not configured");
		}
		return secret;
	}

	private getRefreshTokenTtlSeconds(): number {
		if (!Number.isFinite(this.refreshTokenTtlSeconds) || this.refreshTokenTtlSeconds <= 0) {
			throw createError("ConfigError", "Invalid refresh token TTL configuration");
		}
		return Math.floor(this.refreshTokenTtlSeconds);
	}

	private getAccessTokenTtlSeconds(): number {
		if (!Number.isFinite(this.accessTokenTtlSeconds) || this.accessTokenTtlSeconds <= 0) {
			throw createError("ConfigError", "Invalid access token TTL configuration");
		}
		return Math.floor(this.accessTokenTtlSeconds);
	}

	private createRefreshToken(existingSid?: string): { sid: string; refreshToken: string } {
		const sid = existingSid || crypto.randomUUID();
		const secret = crypto.randomBytes(48).toString("hex");
		return { sid, refreshToken: `${sid}.${secret}` };
	}

	private toSessionUser(user: IUser | AuthenticatedUserDTO | AdminUserDTO): SessionUser {
		const withAdmin = user as { isAdmin?: boolean };
		const isAdmin = typeof withAdmin.isAdmin === "boolean" ? withAdmin.isAdmin : false;
		return {
			publicId: user.publicId,
			email: user.email,
			handle: user.handle,
			username: user.username,
			isAdmin,
		};
	}
}
