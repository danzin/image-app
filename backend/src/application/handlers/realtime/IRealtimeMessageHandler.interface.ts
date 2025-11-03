import { FeedUpdateMessage } from "../../../services/real-time-feed.service";

export interface IRealtimeMessageHandler {
	/**
	 * handle a specific feed update message type
	 */
	handle(io: any, message: FeedUpdateMessage, channel?: string): Promise<void>;

	/**
	 * the message type this handler supports
	 */
	readonly messageType: string;
}
