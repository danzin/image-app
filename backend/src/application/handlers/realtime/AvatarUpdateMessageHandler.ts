import { injectable } from "tsyringe";
import { IRealtimeMessageHandler } from "./IRealtimeMessageHandler.interface";
import { FeedUpdateMessage } from "../../../services/real-time-feed.service";
import { logger } from "../../../utils/winston";

@injectable()
export class AvatarUpdateMessageHandler implements IRealtimeMessageHandler {
	readonly messageType = "avatar_changed";

	async handle(io: any, message: FeedUpdateMessage): Promise<void> {
		if (!message.userId) return;

		// notify all users about avatar change (since avatars appear in feeds)
		io.emit("avatar_update", {
			type: "user_avatar_changed",
			userId: message.userId,
			oldAvatar: message.oldAvatar,
			newAvatar: message.newAvatar,
			timestamp: message.timestamp,
		});

		logger.info(`Real-time avatar update sent for user ${message.userId}`);
	}
}
