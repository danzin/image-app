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
			// Clear all user batch caches since they contain avatar URLs
			console.log("Clearing user batch caches...");
			await this.redis.del(`user_batch:*`);

			// Clear ALL feed caches because the user's avatar appears in:
			// 1. Their own posts in their feed
			// 2. Their posts in other users' feeds

			console.log("Clearing all feed caches due to avatar change...");
			await Promise.all([
				this.redis.del("feed:*"), // Legacy feed caches
				this.redis.del("core_feed:*"), // New partitioned feed caches
			]);

			console.log(`Successfully cleared caches for avatar change of user ${event.userPublicId}`);
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
