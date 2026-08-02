export interface UserSuggestion {
  publicId: string;
  handle: string;
  username: string;
  avatar: string;
  bio?: string;
  followerCount: number;
  postCount: number;
  totalLikes: number;
  score: number;
}

export interface UserSuggestionsResult {
  suggestions: UserSuggestion[];
  cached: boolean;
  timestamp: string;
  activityLevel?: "high" | "medium" | "low" | "dormant";
}

export interface UserSuggestions {
  getCached(
    userPublicId: string,
    limit: number,
  ): Promise<UserSuggestionsResult | null>;
  setCached(
    userPublicId: string,
    limit: number,
    result: UserSuggestionsResult,
    ttlSeconds: number,
  ): Promise<void>;
}
