import { IEventHandler } from "../../common/interfaces/event-handler.interface";
import { inject, injectable } from "tsyringe";
import { UserAvatarChangedEvent } from "./user-interaction.event";
import { RedisService } from "../../../services/redis.service";

@injectable()
export class UserAvatarChangedHandler implements IEventHandler<UserAvatarChangedEvent> {
	constructor(@inject("RedisService") private readonly redis: RedisService) {}

	async handle(event: UserAvatarChangedEvent): Promise<void> {
		console.log(`User ${event.userPublicId} changed avatar, clearing user data caches`);

		// Clear all user batch caches (1-minute TTL anyway)
		await this.redis.del(`user_batch:*`);

		// Core feed caches remain intact!
		console.log("User data caches cleared, core feeds preserved");
	}
}
