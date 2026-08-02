import type { IUser } from "@/types";
import type { UserPublicId } from "@/types/branded";

/**
 * User lookups required by authentication and credential-recovery flows.
 *
 * This port intentionally excludes profile, relationship, directory, and
 * recommendation queries that are unrelated to authentication decisions.
 */
export interface UserAuthenticationLookup {
  findByEmail(email: string): Promise<IUser | null>;
  findByPublicId(publicId: UserPublicId): Promise<IUser | null>;
  findByResetToken(token: string): Promise<IUser | null>;
  findByEmailVerificationToken(
    email: string,
    token: string,
  ): Promise<IUser | null>;
}
