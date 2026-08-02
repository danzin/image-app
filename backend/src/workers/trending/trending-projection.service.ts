import { inject, injectable } from "tsyringe";
import type { IPostReadRepository } from "@/repositories/interfaces";
import { calculateTrendingScore } from "@/services/feed/trending-score.policy";
import type { FeedPost } from "@/types";
import { asPostPublicId } from "@/types/branded";
import { TOKENS } from "@/types/tokens";
import type {
  ITrendingCacheStore,
  ITrendingProjectionService,
  TrendingProjectionBatch,
  TrendingProjectionUpdate,
} from "./trending.ports";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

@injectable()
export class TrendingProjectionService
  implements ITrendingProjectionService
{
  constructor(
    @inject(TOKENS.Repositories.PostRead)
    private readonly postReadRepository: IPostReadRepository,
    @inject(TOKENS.Services.TrendingCacheStore)
    private readonly cacheStore: ITrendingCacheStore,
  ) {}

  async findPostsByPublicIds(
    postIds: readonly string[],
  ): Promise<FeedPost[]> {
    return this.postReadRepository.findPostsByPublicIds(
      postIds.map(asPostPublicId),
    );
  }

  preparePendingUpdates(
    posts: unknown,
    postIds: readonly string[],
  ): TrendingProjectionBatch {
    if (!Array.isArray(posts)) {
      throw new TypeError(
        "Malformed repository result during trending flush",
      );
    }

    const postMap = new Map<string, FeedPost>();
    for (const post of posts) {
      if (
        !isRecord(post) ||
        typeof post.publicId !== "string" ||
        post.publicId.length === 0
      ) {
        throw new TypeError(
          "Malformed repository post during trending flush",
        );
      }
      postMap.set(post.publicId, post as unknown as FeedPost);
    }

    const updates: TrendingProjectionUpdate[] = [];
    const missingPostIds: string[] = [];
    for (const postId of postIds) {
      const post = postMap.get(postId);
      if (!post) {
        missingPostIds.push(postId);
        continue;
      }
      updates.push(this.createUpdate(post));
    }

    return { updates, missingPostIds };
  }

  prepareRefreshUpdates(posts: unknown): TrendingProjectionUpdate[] {
    if (!Array.isArray(posts)) {
      throw new TypeError("Malformed trending full-refresh result");
    }
    return posts.map((post) => this.createUpdate(post as FeedPost));
  }

  async writeUpdates(
    updates: readonly TrendingProjectionUpdate[],
  ): Promise<void> {
    await this.cacheStore.writeUpdates(updates);
  }

  private createUpdate(post: FeedPost): TrendingProjectionUpdate {
    const {
      ageDays,
      comments,
      commentsScore,
      likes,
      popularityScore,
      recencyScore,
      score,
      views,
    } = calculateTrendingScore(post);

    return {
      ageDays,
      comments,
      commentsScore,
      likes,
      popularityScore,
      postId: post.publicId,
      recencyScore,
      score,
      views,
    };
  }
}
