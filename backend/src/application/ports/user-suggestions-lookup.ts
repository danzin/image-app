import type { IUser, UserSuggestion } from "@/types";
import type { MongoId, UserPublicId } from "@/types/branded";

/**
 * Database-backed recommendation queries used to build who-to-follow results.
 * Cache reads and writes remain behind the separate UserSuggestions port.
 */
export interface UserSuggestionsLookup {
  findByPublicId(publicId: UserPublicId): Promise<IUser | null>;
  getSuggestedUsersLowTraffic(
    currentUserId: MongoId,
    limit?: number,
    recentlyActiveUserPublicIds?: UserPublicId[],
  ): Promise<UserSuggestion[]>;
  getSuggestedUsersHighTraffic(
    currentUserId: MongoId,
    limit?: number,
  ): Promise<UserSuggestion[]>;
}
