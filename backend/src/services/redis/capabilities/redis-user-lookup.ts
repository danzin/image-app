import { inject, injectable } from "tsyringe";
import type { IUserReadRepository } from "@/repositories/interfaces";
import { RedisService } from "@/services/redis.service";
import { CacheConfig } from "@/config/cacheConfig";
import { CacheKeyBuilder } from "@/utils/cache/CacheKeyBuilder";
import { asUserPublicId } from "@/types/branded";
import type { UserLookup } from "@/application/ports/user-lookup";
import type { UserLookupData } from "@/types";
import { TOKENS } from "@/types/tokens";

@injectable()
export class RedisUserLookup implements UserLookup {
  constructor(
    @inject(TOKENS.Services.Redis)
    private readonly redisService: RedisService,
    @inject(TOKENS.Repositories.UserRead)
    private readonly userReadRepository: IUserReadRepository,
  ) {}

  async findMany(userPublicIds: readonly string[]): Promise<UserLookupData[]> {
    if (userPublicIds.length === 0) return [];

    const ids = [...userPublicIds];
    const keys = ids.map((id) =>
      CacheKeyBuilder.getUserDataKey(asUserPublicId(id)),
    );
    const cached = await this.redisService.mGet<UserLookupData>(keys);

    const results: UserLookupData[] = [];
    const missingIds: string[] = [];

    for (let i = 0; i < ids.length; i++) {
      if (cached[i]) {
        results.push(cached[i]!);
      } else {
        missingIds.push(ids[i]);
      }
    }

    if (missingIds.length > 0) {
      const fetchedUsers = await this.userReadRepository.findUsersByPublicIds(
        missingIds.map(asUserPublicId),
      );

      if (fetchedUsers.length > 0) {
        await this.redisService.setManyWithTags(
          fetchedUsers.map((user) => ({
            key: CacheKeyBuilder.getUserDataKey(user.publicId),
            value: user,
            tags: [`user_data:${user.publicId}`],
          })),
          CacheConfig.FEED.USER_DATA,
        );
      }

      results.push(...fetchedUsers);
    }

    return results;
  }
}
