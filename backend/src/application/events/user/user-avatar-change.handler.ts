import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { UserAvatarChangedEvent } from "./user-interaction.event";
import { RedisService } from "../../../services/redis.service";

@injectable()
export class UserAvatarChangedHandler implements IEventHandler<UserAvatarChangedEvent> {
	constructor(@inject("RedisService") private readonly redis: RedisService) {}

	async handle(event: UserAvatarChangedEvent): Promise<void> {
		console.log(
			`User ${event.userPublicId} changed avatar from "${event.oldAvatarUrl || "none"}" to "${event.newAvatarUrl}"`
		);

		try {
			// Smart invalidation: only invalidate user data caches that contain this user's avatar
			const avatarTags = [`user_data:${event.userPublicId}`];
			await this.redis.invalidateByTags(avatarTags);

			// For feeds, we need to invalidate feeds of users who follow this user
			// and feeds that contain posts from this user
			const followerTags = [`user_feed:${event.userPublicId}`]; // User's own feed
			await this.redis.invalidateByTags(followerTags);

			// Publish real-time avatar update
			await this.redis.publish("feed_updates", {
				type: "avatar_changed",
				userId: event.userPublicId,
				oldAvatar: event.oldAvatarUrl,
				newAvatar: event.newAvatarUrl,
				timestamp: new Date().toISOString(),
			});

			console.log(`Smart cache invalidation completed for avatar change of user ${event.userPublicId}`);
		} catch (error) {
			console.error(`Error while handling avatar change for user ${event.userPublicId}:`, error);

			// Fallback: try to clear all caches
			try {
				await Promise.all([
					this.redis.del("*"), // Nuke everything
				]);
				console.log(" Fallback: Cleared all Redis caches due to error");
			} catch (fallbackError) {
				console.error(" Even fallback cache clear failed:", fallbackError);
			}
		}
	}
}
