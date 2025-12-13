import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { UserCoverChangedEvent } from "./user-interaction.event";
import { RedisService } from "../../../services/redis.service";
import { logger } from "../../../utils/winston";

@injectable()
export class UserCoverChangedHandler implements IEventHandler<UserCoverChangedEvent> {
	constructor(@inject("RedisService") private readonly redis: RedisService) {}

	async handle(event: UserCoverChangedEvent): Promise<void> {
		logger.info(
			`User ${event.userPublicId} changed cover from "${event.oldCoverUrl || "none"}" to "${event.newCoverUrl}"`
		);

		try {
			// invalidate user data caches
			const coverTags = [`user_data:${event.userPublicId}`];
			await this.redis.invalidateByTags(coverTags);

			logger.info(`Cache invalidation completed for cover change of user ${event.userPublicId}`);
		} catch (error) {
			console.error(`Error while handling cover change for user ${event.userPublicId}:`, error);
		}
	}
}
