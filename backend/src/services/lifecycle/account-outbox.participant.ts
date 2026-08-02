import { inject, injectable } from "tsyringe";
import { EventBus } from "@/application/common/buses/event.bus";
import { ImageAssetCleanupRequestedEvent } from "@/application/events/image/image.event";
import {
  PostDeletedEvent,
  PostLikeCountReconciledEvent,
} from "@/application/events/post/post.event";
import {
  UserBannedEvent,
  UserDeletedEvent,
} from "@/application/events/user/user-interaction.event";
import {
  asMongoId,
  asPostPublicId,
  asUserPublicId,
} from "@/types/branded";
import { TOKENS } from "@/types/tokens";
import {
  AccountLifecycleUser,
  AccountOutboxParticipant,
  AccountOutboxOptions,
  AccountPurgeResult,
} from "./account-lifecycle.ports";

@injectable()
export class EventBusAccountOutboxParticipant
  implements AccountOutboxParticipant
{
  constructor(
    @inject(TOKENS.CQRS.Handlers.EventBus)
    private readonly eventBus: EventBus,
  ) {}

  async enqueue(
    user: AccountLifecycleUser,
    options: AccountOutboxOptions,
    result: AccountPurgeResult,
  ): Promise<void> {
    for (const post of result.deletedPosts) {
      const authorPublicId = asUserPublicId(
        post.authorPublicId || user.publicId,
      );
      await this.eventBus.queueTransactional(
        new PostDeletedEvent(asPostPublicId(post.publicId), authorPublicId),
      );
    }

    for (const asset of result.imageAssets) {
      await this.eventBus.queueTransactional(
        new ImageAssetCleanupRequestedEvent(
          options.action === "ban" ? "account-banned" : "account-deleted",
          asset.storagePublicId,
          asset.url,
          asUserPublicId(options.requestedByPublicId ?? user.publicId),
          asUserPublicId(asset.ownerPublicId || user.publicId),
        ),
      );
    }

    for (const post of result.reconciledPostLikes) {
      await this.eventBus.queueTransactional(
        new PostLikeCountReconciledEvent(
          asPostPublicId(post.postPublicId),
          post.likesCount,
        ),
      );
    }

    const deletedPostPublicIds = result.deletedPosts
      .filter(
        (post) =>
          (post.authorPublicId || user.publicId) === user.publicId,
      )
      .map((post) => asPostPublicId(post.publicId));
    if (options.action === "ban") {
      await this.eventBus.queueTransactional(
        new UserBannedEvent(
          asUserPublicId(user.publicId),
          asMongoId(user._id.toString()),
          result.followerPublicIds.map((publicId) => asUserPublicId(publicId)),
          result.affectedRelationshipPublicIds.map((publicId) =>
            asUserPublicId(publicId),
          ),
          deletedPostPublicIds,
        ),
      );
      return;
    }

    await this.eventBus.queueTransactional(
      new UserDeletedEvent(
        asUserPublicId(user.publicId),
        asMongoId(user._id.toString()),
        result.followerPublicIds.map((publicId) => asUserPublicId(publicId)),
        result.affectedRelationshipPublicIds.map((publicId) =>
          asUserPublicId(publicId),
        ),
        deletedPostPublicIds,
      ),
    );
  }
}
