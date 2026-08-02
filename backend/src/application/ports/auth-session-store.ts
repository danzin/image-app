export type AuthSessionRotationOutcome =
  | "rotated"
  | "stale_previous"
  | "missing"
  | "revoked"
  | "mismatch"
  | "identity_mismatch"
  | "invalid_record"
  | "version_conflict";

export interface AuthSessionRotationInput {
  sid: string;
  publicId: string;
  presentedRefreshTokenHash: string;
  nextRefreshTokenHash: string;
  expectedRefreshVersion: number;
  now: number;
  previousRefreshTokenGraceUntil: number;
  ttlSeconds: number;
  ip?: string;
  userAgent?: string;
}

export interface AuthSessionRotationResult<T> {
  outcome: AuthSessionRotationOutcome;
  session: T | null;
}

export type AuthSessionMetadataPatchOutcome =
  | "updated"
  | "missing"
  | "identity_mismatch"
  | "invalid_record";

export interface AuthSessionMetadataPatchInput {
  sid: string;
  publicId: string;
}

export interface AuthSessionTouchInput extends AuthSessionMetadataPatchInput {
  lastSeenAt: number;
}

export type AuthSessionRevocationOutcome =
  | "revoked"
  | "missing"
  | "inactive"
  | "mismatch"
  | "identity_mismatch"
  | "invalid_record";

export interface AuthSessionRevocationInput {
  sid: string;
  presentedRefreshTokenHash: string;
  now: number;
}

export interface AuthSessionStore {
  save<T extends { sid: string; publicId: string }>(
    session: T,
    ttlSeconds: number,
  ): Promise<void>;
  get<T>(sid: string): Promise<T | null>;
  compareAndRotate<T>(
    input: AuthSessionRotationInput,
  ): Promise<AuthSessionRotationResult<T>>;
  revokeByRefreshToken(
    input: AuthSessionRevocationInput,
  ): Promise<AuthSessionRevocationOutcome>;
  remove(sid: string, publicId: string): Promise<void>;
  removeMembership(publicId: string, sid: string): Promise<void>;
  getUserSessionIds(publicId: string): Promise<string[]>;
  deleteUserSessions(publicId: string, sessionIds: string[]): Promise<void>;
  markEmailVerified(
    input: AuthSessionMetadataPatchInput,
  ): Promise<AuthSessionMetadataPatchOutcome>;
  touch(
    input: AuthSessionTouchInput,
  ): Promise<AuthSessionMetadataPatchOutcome>;
}
