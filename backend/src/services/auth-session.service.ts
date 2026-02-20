import crypto from "crypto";
import { inject, injectable } from "tsyringe";
import { RedisService } from "@/services/redis.service";
import { AuthSessionRecord } from "@/types";
import { createError } from "@/utils/errors";

const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;
const DEFAULT_REFRESH_ROTATION_GRACE_SECONDS = 15 * 60;
const DEFAULT_ACCESS_TOUCH_INTERVAL_SECONDS = 60;

export interface SessionContext {
	ip?: string;
	userAgent?: string;
}

export interface CreateSessionInput extends SessionContext {
	sid: string;
	publicId: string;
	refreshToken: string;
	ttlSeconds: number;
}

@injectable()
export class AuthSessionService {
	constructor(@inject("RedisService") private readonly redisService: RedisService) {}

	extractSessionIdFromRefreshToken(refreshToken: string): string | null {
		const [sid, secret, ...rest] = refreshToken.split(".");
		if (!sid || !secret || rest.length > 0) return null;
		if (!SESSION_ID_REGEX.test(sid)) return null;
		return sid;
	}

	async createSession(input: CreateSessionInput): Promise<AuthSessionRecord> {
		const ttlSeconds = this.normalizeTtlSeconds(input.ttlSeconds);
		const now = Date.now();
		const session: AuthSessionRecord = {
			sid: input.sid,
			publicId: input.publicId,
			refreshTokenHash: this.hashRefreshToken(input.refreshToken),
			createdAt: now,
			lastSeenAt: now,
			ip: input.ip,
			userAgent: input.userAgent,
			status: "active",
		};

		const pipeline = this.redisService.clientInstance.multi();
		pipeline.setEx(this.sessionKey(input.sid), ttlSeconds, JSON.stringify(session));
		pipeline.sAdd(this.userSessionsKey(input.publicId), input.sid);
		pipeline.expire(this.userSessionsKey(input.publicId), ttlSeconds);
		await pipeline.exec();

		return session;
	}

	async getSession(sid: string): Promise<AuthSessionRecord | null> {
		if (!SESSION_ID_REGEX.test(sid)) return null;
		return this.redisService.get<AuthSessionRecord>(this.sessionKey(sid));
	}

	async assertAccessSession(sid: string, publicId: string): Promise<AuthSessionRecord> {
		const session = await this.getSession(sid);
		if (!session) {
			// If the session key was evicted, proactively clear stale membership index entry.
			await this.redisService.clientInstance.sRem(this.userSessionsKey(publicId), sid);
			throw createError("AuthenticationError", "Session is invalid or expired");
		}
		if (session.status !== "active" || session.publicId !== publicId) {
			throw createError("AuthenticationError", "Session is invalid or expired");
		}
		await this.touchSessionOnAccess(session);
		return session;
	}

	async validateRefreshToken(refreshToken: string): Promise<AuthSessionRecord> {
		const sid = this.extractSessionIdFromRefreshToken(refreshToken);
		if (!sid) {
			throw createError("AuthenticationError", "Invalid refresh token");
		}

		const session = await this.getSession(sid);
		if (!session || session.status !== "active") {
			throw createError("AuthenticationError", "Session is invalid or expired");
		}

		const presentedHash = this.hashRefreshToken(refreshToken);
		const matchState = this.classifyRefreshTokenMatch(session, presentedHash);
		if (matchState === "recently_rotated") {
			throw createError("AuthenticationError", "Refresh token already rotated");
		}
		if (matchState !== "current") {
			await this.revokeSession(sid);
			throw createError("AuthenticationError", "Refresh token reuse detected");
		}

		return session;
	}

	async rotateRefreshToken(
		sid: string,
		presentedRefreshToken: string,
		nextRefreshToken: string,
		ttlSeconds: number,
		context?: SessionContext,
	): Promise<AuthSessionRecord> {
		const current = await this.getSession(sid);
		if (!current || current.status !== "active") {
			throw createError("AuthenticationError", "Session is invalid or expired");
		}

		const presentedHash = this.hashRefreshToken(presentedRefreshToken);
		const matchState = this.classifyRefreshTokenMatch(current, presentedHash);
		if (matchState === "recently_rotated") {
			throw createError("AuthenticationError", "Refresh token already rotated");
		}
		if (matchState !== "current") {
			await this.revokeSession(sid);
			throw createError("AuthenticationError", "Refresh token reuse detected");
		}

		const now = Date.now();
		const normalizedTtl = this.normalizeTtlSeconds(ttlSeconds);
		const next: AuthSessionRecord = {
			...current,
			refreshTokenHash: this.hashRefreshToken(nextRefreshToken),
			previousRefreshTokenHash: current.refreshTokenHash,
			previousRefreshTokenGraceUntil: now + this.getRefreshRotationGraceMs(),
			lastSeenAt: now,
			ip: context?.ip ?? current.ip,
			userAgent: context?.userAgent ?? current.userAgent,
		};

		const pipeline = this.redisService.clientInstance.multi();
		pipeline.setEx(this.sessionKey(sid), normalizedTtl, JSON.stringify(next));
		pipeline.sAdd(this.userSessionsKey(next.publicId), sid);
		pipeline.expire(this.userSessionsKey(next.publicId), normalizedTtl);
		await pipeline.exec();

		return next;
	}

	async revokeSession(sid: string): Promise<void> {
		const session = await this.getSession(sid);
		if (!session) return;

		const pipeline = this.redisService.clientInstance.multi();
		pipeline.del(this.sessionKey(sid));
		pipeline.sRem(this.userSessionsKey(session.publicId), sid);
		await pipeline.exec();
	}

	async revokeAllSessionsForUser(publicId: string): Promise<void> {
		const userSessionsKey = this.userSessionsKey(publicId);
		const sessionIds = await this.redisService.clientInstance.sMembers(userSessionsKey);
		if (sessionIds.length === 0) {
			await this.redisService.clientInstance.del(userSessionsKey);
			return;
		}

		const keysToDelete = sessionIds.map((sid) => this.sessionKey(sid));
		keysToDelete.push(userSessionsKey);
		await this.redisService.clientInstance.del(keysToDelete);
	}

	private sessionKey(sid: string): string {
		return `session:${sid}`;
	}

	private userSessionsKey(publicId: string): string {
		return `user:sessions:${publicId}`;
	}

	private hashRefreshToken(refreshToken: string): string {
		return crypto.createHash("sha256").update(refreshToken, "utf8").digest("hex");
	}

	private hashesMatch(storedHash: string, presentedHash: string): boolean {
		if (!SHA256_HEX_REGEX.test(storedHash) || !SHA256_HEX_REGEX.test(presentedHash)) {
			return false;
		}

		const stored = Buffer.from(storedHash, "hex");
		const presented = Buffer.from(presentedHash, "hex");
		if (stored.length !== presented.length) return false;

		return crypto.timingSafeEqual(stored, presented);
	}

	private classifyRefreshTokenMatch(
		session: AuthSessionRecord,
		presentedHash: string,
		now: number = Date.now(),
	): "current" | "recently_rotated" | "unknown" {
		if (this.hashesMatch(session.refreshTokenHash, presentedHash)) {
			return "current";
		}

		const previousHash = session.previousRefreshTokenHash;
		const previousGraceUntil = session.previousRefreshTokenGraceUntil ?? 0;
		if (previousHash && this.hashesMatch(previousHash, presentedHash) && previousGraceUntil >= now) {
			return "recently_rotated";
		}

		return "unknown";
	}

	private async touchSessionOnAccess(session: AuthSessionRecord): Promise<void> {
		const now = Date.now();
		if (now - session.lastSeenAt < this.getAccessTouchIntervalMs()) {
			return;
		}

		const key = this.sessionKey(session.sid);
		const ttlSeconds = await this.redisService.clientInstance.ttl(key);
		if (ttlSeconds <= 0) {
			await this.redisService.clientInstance.sRem(this.userSessionsKey(session.publicId), session.sid);
			throw createError("AuthenticationError", "Session is invalid or expired");
		}

		const touchedSession: AuthSessionRecord = {
			...session,
			lastSeenAt: now,
		};
		await this.redisService.clientInstance.setEx(key, ttlSeconds, JSON.stringify(touchedSession));
	}

	private getRefreshRotationGraceMs(): number {
		return this.readPositiveIntegerEnv(
			"REFRESH_TOKEN_ROTATION_GRACE_SECONDS",
			DEFAULT_REFRESH_ROTATION_GRACE_SECONDS,
		) * 1000;
	}

	private getAccessTouchIntervalMs(): number {
		return this.readPositiveIntegerEnv(
			"SESSION_ACCESS_TOUCH_INTERVAL_SECONDS",
			DEFAULT_ACCESS_TOUCH_INTERVAL_SECONDS,
		) * 1000;
	}

	private readPositiveIntegerEnv(key: string, fallback: number): number {
		const raw = process.env[key];
		if (raw === undefined) {
			return fallback;
		}
		const parsed = Number(raw);
		if (!Number.isFinite(parsed) || parsed <= 0) {
			return fallback;
		}
		return Math.floor(parsed);
	}

	private normalizeTtlSeconds(ttlSeconds: number): number {
		if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
			throw createError("ConfigError", "Invalid session TTL configuration");
		}
		return Math.floor(ttlSeconds);
	}
}
