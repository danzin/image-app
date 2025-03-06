import { IEventHandler } from "../../../application/common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { UserInteractedWithImageEvent } from "../user/user-interaction.event";
import { FeedService } from "../../../services/feed.service";
import { RedisService } from "../../../services/redis.service";

@injectable()
export class FeedInteractionHandler 
  implements IEventHandler<UserInteractedWithImageEvent> {

  constructor(
    @inject('FeedService') private readonly feedService: FeedService,
    @inject('RedisService') private readonly redis: RedisService
  ) {}

  async handle(event: UserInteractedWithImageEvent): Promise<void> {
    try {
      await this.feedService.recordInteraction(
        event.userId,
        event.interactionType,
        event.imageId,
        event.tags
      );
      
      // Invalidate relevant cache entries
      await this.redis.del(`feed:${event.userId}:*`);
    } catch (error) {
      console.error('Feed update failed:', error);
      throw error;
    }
  }
}