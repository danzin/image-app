import { inject, injectable } from "tsyringe";
import type {
  FeedCache,
  FeedPostMetadata,
} from "@/application/ports/feed-cache";
import { RedisService } from "@/services/redis.service";
import { asPostPublicId } from "@/types/branded";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";
import { TOKENS } from "@/types/tokens";

@injectable()
export class RedisFeedCache implements FeedCache {
  constructor(
    @inject(TOKENS.Services.Redis)
    private readonly redisService: RedisService,
  ) {}

  async getPostMetadata(
    postPublicIds: readonly string[],
  ): Promise<(FeedPostMetadata | null)[]> {
    const keys = postPublicIds.map((id) =>
      CacheKeyBuilder.getPostMetaKey(asPostPublicId(id)),
    );
    return this.redisService.mGet<FeedPostMetadata>(keys);
  }
}
