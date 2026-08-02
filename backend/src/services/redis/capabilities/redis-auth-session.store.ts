import { inject, injectable } from "tsyringe";
import type {
  AuthSessionMetadataPatchInput,
  AuthSessionMetadataPatchOutcome,
  AuthSessionRevocationInput,
  AuthSessionRevocationOutcome,
  AuthSessionRotationInput,
  AuthSessionRotationResult,
  AuthSessionStore,
  AuthSessionTouchInput,
} from "@/application/ports/auth-session-store";
import { RedisService } from "@/services/redis.service";
import { TOKENS } from "@/types/tokens";

@injectable()
export class RedisAuthSessionStore implements AuthSessionStore {
  constructor(
    @inject(TOKENS.Services.Redis)
    private readonly redisService: RedisService,
  ) {}

  async save<T extends { sid: string; publicId: string }>(
    session: T,
    ttlSeconds: number,
  ): Promise<void> {
    return this.redisService.saveAuthSession(session, ttlSeconds);
  }

  async get<T>(sid: string): Promise<T | null> {
    return this.redisService.getAuthSession<T>(sid);
  }

  async compareAndRotate<T>(
    input: AuthSessionRotationInput,
  ): Promise<AuthSessionRotationResult<T>> {
    return this.redisService.compareAndRotateAuthSession<T>(input);
  }

  async revokeByRefreshToken(
    input: AuthSessionRevocationInput,
  ): Promise<AuthSessionRevocationOutcome> {
    return this.redisService.revokeAuthSessionByRefreshToken(input);
  }

  async remove(sid: string, publicId: string): Promise<void> {
    return this.redisService.removeAuthSession(sid, publicId);
  }

  async removeMembership(publicId: string, sid: string): Promise<void> {
    return this.redisService.removeAuthSessionMembership(publicId, sid);
  }

  async getUserSessionIds(publicId: string): Promise<string[]> {
    return this.redisService.getUserAuthSessionIds(publicId);
  }

  async deleteUserSessions(
    publicId: string,
    sessionIds: string[],
  ): Promise<void> {
    return this.redisService.deleteUserAuthSessions(publicId, sessionIds);
  }

  async markEmailVerified(
    input: AuthSessionMetadataPatchInput,
  ): Promise<AuthSessionMetadataPatchOutcome> {
    return this.redisService.markAuthSessionEmailVerified(input);
  }

  async touch(
    input: AuthSessionTouchInput,
  ): Promise<AuthSessionMetadataPatchOutcome> {
    return this.redisService.touchAuthSession(input);
  }
}
