import crypto from "crypto";
import { inject, injectable } from "tsyringe";
import { RedisService } from "@/services/redis.service";
import { AuthSessionRecord } from "@/types";
import { createError } from "@/utils/errors";

const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

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
		if (!session || session.status !== "active" || session.publicId !== publicId) {
			throw createError("AuthenticationError", "Session is invalid or expired");
		}
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
		if (!this.hashesMatch(session.refreshTokenHash, presentedHash)) {
			await this.revokeSession(sid);
			throw createError("AuthenticationError", "Refresh token reuse detected");
		}

		return session;
	}

	async rotateRefreshToken(
		sid: string,
		refreshToken: string,
		ttlSeconds: number,
		context?: SessionContext,
	): Promise<AuthSessionRecord> {
		const current = await this.getSession(sid);
		if (!current || current.status !== "active") {
			throw createError("AuthenticationError", "Session is invalid or expired");
		}

		const normalizedTtl = this.normalizeTtlSeconds(ttlSeconds);
		const next: AuthSessionRecord = {
			...current,
			refreshTokenHash: this.hashRefreshToken(refreshToken),
			lastSeenAt: Date.now(),
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

	private normalizeTtlSeconds(ttlSeconds: number): number {
		if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
			throw createError("ConfigError", "Invalid session TTL configuration");
		}
		return Math.floor(ttlSeconds);
	}
}
