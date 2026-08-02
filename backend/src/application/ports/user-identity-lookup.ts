import type { IUser } from "@/types";
import type { UserPublicId } from "@/types/branded";

/**
 * Resolves the active user identity needed by authentication middleware.
 */
export interface UserIdentityLookup {
  findByPublicId(publicId: UserPublicId): Promise<IUser | null>;
}
