import { inject, injectable } from "tsyringe";
import type {
  UserSuggestions,
  UserSuggestionsResult,
} from "@/application/ports/user-suggestions";
import { RedisService } from "@/services/redis.service";
import { TOKENS } from "@/types/tokens";

@injectable()
export class RedisUserSuggestions implements UserSuggestions {
  constructor(
    @inject(TOKENS.Services.Redis)
    private readonly redisService: RedisService,
  ) {}

  async getCached(
    userPublicId: string,
    limit: number,
  ): Promise<UserSuggestionsResult | null> {
    return this.redisService.getWithTags(
      this.cacheKey(userPublicId, limit),
    );
  }

  async setCached(
    userPublicId: string,
    limit: number,
    result: UserSuggestionsResult,
    ttlSeconds: number,
  ): Promise<void> {
    const cacheKey = this.cacheKey(userPublicId, limit);
    const tags = [
      "who_to_follow",
      `user_suggestions:${userPublicId}`,
    ];
    return this.redisService.setWithTags(cacheKey, result, tags, ttlSeconds);
  }

  private cacheKey(userPublicId: string, limit: number): string {
    return `who_to_follow:${userPublicId}:limit:${limit}`;
  }
}
