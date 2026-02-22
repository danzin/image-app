import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";
import { RecordPostViewCommand } from "./recordPostView.command";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { PostViewRepository } from "@/repositories/postView.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { FeedService } from "@/services/feed.service";
import { TransactionQueueService } from "@/services/transaction-queue.service";
import { BloomFilterService } from "@/services/bloom-filter.service";
import { createError } from "@/utils/errors";
import { isValidPublicId } from "@/utils/sanitizers";
import {
  PostAuthorizationError,
  PostNotFoundError,
  UserNotFoundError,
  mapPostError,
} from "@/application/errors/post.errors";
import { logger } from "@/utils/winston";
import { IPost, IUser } from "@/types";
import { getPostViewBloomKey, POST_VIEW_BLOOM_OPTIONS, POST_VIEW_BLOOM_TTL_SECONDS } from "@/config/bloomConfig";

@injectable()
export class RecordPostViewCommandHandler implements ICommandHandler<RecordPostViewCommand, boolean> {
  constructor(
    @inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
    @inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
    @inject("PostViewRepository") private readonly postViewRepository: PostViewRepository,
    @inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
    @inject("FeedService") private readonly feedService: FeedService,
    @inject("TransactionQueueService") private readonly transactionQueue: TransactionQueueService,
    @inject("BloomFilterService") private readonly bloomFilterService: BloomFilterService,
  ) { }

  async execute(command: RecordPostViewCommand): Promise<boolean> {
    try {
      if (!isValidPublicId(command.postPublicId)) {
        throw createError("ValidationError", "Invalid postPublicId format");
      }

      if (!isValidPublicId(command.userPublicId)) {
        throw createError("ValidationError", "Invalid userPublicId format");
      }

      const post = await this.postReadRepository.findOneByPublicId(command.postPublicId);

      if (!post) {
        throw new PostNotFoundError();
      }

      const postId = post._id as mongoose.Types.ObjectId;

      const user = await this.userReadRepository.findByPublicId(command.userPublicId);

      if (!user) {
        throw new UserNotFoundError();
      }

      const userId = user._id as mongoose.Types.ObjectId;

      const isOwner =
        typeof (post as IPost).isOwnedBy === "function"
          ? (post as IPost).isOwnedBy(userId)
          : post.user.toString() === userId.toString();
      if (isOwner) {
        return false;
      }

      if (typeof (user as IUser).canViewPost === "function" && !(user as IUser).canViewPost(post)) {
        throw new PostAuthorizationError("User cannot view this post");
      }

      if (typeof (post as IPost).canBeViewedBy === "function" && !(post as IPost).canBeViewedBy(user)) {
        throw new PostAuthorizationError("User cannot view this post");
      }

      const bloomKey = getPostViewBloomKey(command.postPublicId);
      const alreadyViewed = await this.wasLikelyAlreadyViewedByUser(bloomKey, command.userPublicId);
      if (alreadyViewed) {
        return false;
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      let isNewView = false;
      try {
        isNewView = await this.postViewRepository.recordView(postId, userId, session);

        if (isNewView) {
          await this.postWriteRepository.incrementViewCount(postId, session);
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }

      await this.markViewSeenInBloom(bloomKey, command.userPublicId);

      if (isNewView) {
        // Queue redis and cache updates separately from DB transaction
        this.transactionQueue
          .executeOrQueue(
            async () => {
              const updatedPost = await this.postReadRepository.findOneByPublicId(command.postPublicId);
              if (updatedPost?.viewsCount !== undefined) {
                await this.feedService.updatePostViewMeta(command.postPublicId, updatedPost.viewsCount);
              }
            },
            { priority: "low", loadThreshold: 30 },
          )
          .catch((err) => {
            logger.warn("[RecordPostView] Failed to update view count metadata in feed (non-critical)", {
              postPublicId: command.postPublicId,
              error: err instanceof Error ? err.message : String(err),
            });
          });
      }

      return isNewView;
    } catch (error) {
      throw mapPostError(error, {
        action: "record-post-view",
        postPublicId: command.postPublicId,
        userPublicId: command.userPublicId,
      });
    }
  }

  private async wasLikelyAlreadyViewedByUser(bloomKey: string, userPublicId: string): Promise<boolean> {
    try {
      return await this.bloomFilterService.mightContain(bloomKey, userPublicId, POST_VIEW_BLOOM_OPTIONS);
    } catch (error) {
      logger.warn("[Bloom][post-view] read failed; falling back to DB uniqueness check", {
        bloomKey,
        userPublicId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async markViewSeenInBloom(bloomKey: string, userPublicId: string): Promise<void> {
    try {
      await this.bloomFilterService.add(bloomKey, userPublicId, POST_VIEW_BLOOM_OPTIONS, POST_VIEW_BLOOM_TTL_SECONDS);
    } catch (error) {
      logger.warn("[Bloom][post-view] failed to seed bloom filter after view write", {
        bloomKey,
        userPublicId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
