import { IEventHandler } from "@/application/common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { UserUsernameChangedEvent } from "./user-interaction.event";
import { RedisService } from "@/services/redis.service";
import { logger } from "@/utils/winston";

@injectable()
export class UserUsernameChangedHandler implements IEventHandler<UserUsernameChangedEvent> {
	constructor(@inject("RedisService") private readonly redis: RedisService) {}

	async handle(event: UserUsernameChangedEvent): Promise<void> {
		logger.info(`User ${event.userPublicId} changed username from "${event.oldUsername}" to "${event.newUsername}"`);

		try {
			// invalidate user data caches
			const userTags = [`user_data:${event.userPublicId}`];
			await this.redis.invalidateByTags(userTags);

			// invalidate feed caches that might contain old username
			const feedTags = [`user_feed:${event.userPublicId}`];
			await this.redis.invalidateByTags(feedTags);

			// publish to profile_snapshot_updates channel for background worker to update embedded author snapshots in posts
			await this.redis.publish("profile_snapshot_updates", {
				type: "username_changed",
				userPublicId: event.userPublicId,
				username: event.newUsername,
				timestamp: new Date().toISOString(),
			});

			logger.info(`Cache invalidation completed for username change of user ${event.userPublicId}`);
		} catch (error) {
			console.error(`Error while handling username change for user ${event.userPublicId}:`, error);
		}
	}
}
