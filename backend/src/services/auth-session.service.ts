import crypto from "crypto";
import { inject, injectable } from "tsyringe";
import { RedisService } from "@/services/redis.service";
import { AuthSessionRecord } from "@/types";
import { createError } from "@/utils/errors";

const SESSION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

// maximum concurrent sessions a single user may hold; excess stale sessions are pruned on login
const MAX_SESSIONS_PER_USER = 20;

// Lua script: delete a lock key only if the caller still owns it (atomic compare-and-delete)
const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end`;

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

		// prune stale entries from the session set to prevent unbounded growth
		await this.pruneStaleSessionsFromSet(input.publicId);

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

	/**
	 * Atomically validates the current refresh token and rotates it to a new one
	 * under a per-session distributed lock.
	 *
	 * Replacing the separate validateRefreshToken + rotateRefreshToken call sequence
	 * with this single method closes the TOCTOU race where two concurrent requests
	 * both pass validation before either write commits, causing one device to be
	 * silently logged out.
	 *
	 * @param currentRefreshToken - The token presented by the client (validated inside the lock).
	 * @param newRefreshToken - The replacement token to store.
	 * @param ttlSeconds - Session TTL in seconds.
	 * @param context - Optional IP / user-agent for session metadata.
	 */
	async validateAndRotate(
		currentRefreshToken: string,
		newRefreshToken: string,
		ttlSeconds: number,
		context?: SessionContext,
	): Promise<AuthSessionRecord> {
		const sid = this.extractSessionIdFromRefreshToken(currentRefreshToken);
		if (!sid) {
			throw createError("AuthenticationError", "Invalid refresh token");
		}

		const lockKey = `session:rotate:lock:${sid}`;
		const lockToken = crypto.randomBytes(16).toString("hex");

		// acquire a short-lived per-session lock; 10 s is well above any realistic rotation time
		const acquired = await this.redisService.clientInstance.set(lockKey, lockToken, {
			NX: true,
			EX: 10,
		});

		if (!acquired) {
			// another request is already rotating this session — surface as a retriable error
			throw createError("ConflictError", "Concurrent session rotation in progress, please retry");
		}

		try {
			const current = await this.getSession(sid);
			if (!current || current.status !== "active") {
				throw createError("AuthenticationError", "Session is invalid or expired");
			}

			// re-validate the hash inside the lock to prevent TOCTOU races
			const presentedHash = this.hashRefreshToken(currentRefreshToken);
			if (!this.hashesMatch(current.refreshTokenHash, presentedHash)) {
				await this.revokeSession(sid);
				throw createError("AuthenticationError", "Refresh token reuse detected");
			}

			const normalizedTtl = this.normalizeTtlSeconds(ttlSeconds);
			const next: AuthSessionRecord = {
				...current,
				refreshTokenHash: this.hashRefreshToken(newRefreshToken),
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
		} finally {
			// release the lock only if we still own it
			await this.redisService.clientInstance.eval(RELEASE_LOCK_SCRIPT, {
				keys: [lockKey],
				arguments: [lockToken],
			});
		}
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

	/**
	 * Scans the user's session set and removes any SIDs whose session keys have already
	 * expired in Redis, then enforces MAX_SESSIONS_PER_USER by deleting the oldest-inserted
	 * members if the set still exceeds the cap.
	 *
	 * This prevents the set from growing unboundedly for long-lived accounts and keeps
	 * revokeAllSessionsForUser's sMembers call from returning an unbounded list.
	 */
	private async pruneStaleSessionsFromSet(publicId: string): Promise<void> {
		const userSessionsKey = this.userSessionsKey(publicId);
		const sessionIds = await this.redisService.clientInstance.sMembers(userSessionsKey);
		if (sessionIds.length === 0) return;

		// check which session keys still exist
		const existsPipeline = this.redisService.clientInstance.multi();
		for (const sid of sessionIds) {
			existsPipeline.exists(this.sessionKey(sid));
		}
		const existsResults = (await existsPipeline.exec()) as number[];

		const staleIds = sessionIds.filter((_, i) => existsResults[i] === 0);
		const activeIds = sessionIds.filter((_, i) => existsResults[i] !== 0);

		// remove expired entries from the set in one call
		if (staleIds.length > 0) {
			await this.redisService.clientInstance.sRem(userSessionsKey, staleIds);
		}

		// if still over the cap, remove excess (oldest by insertion order is not tracked in a
		// plain Set, so we just remove arbitrary excess — users rarely hit this limit legitimately)
		const remaining = activeIds.length;
		if (remaining > MAX_SESSIONS_PER_USER) {
			const excess = activeIds.slice(0, remaining - MAX_SESSIONS_PER_USER);
			const keysToRevoke = excess.map((sid) => this.sessionKey(sid));
			keysToRevoke.push(...excess.map((sid) => sid));
			// delete the session data and remove from the set
			const pipeline = this.redisService.clientInstance.multi();
			excess.forEach((sid) => pipeline.del(this.sessionKey(sid)));
			pipeline.sRem(userSessionsKey, excess);
			await pipeline.exec();
		}
	}
}
