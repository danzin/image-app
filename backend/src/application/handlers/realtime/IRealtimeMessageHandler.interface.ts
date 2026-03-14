import { Server as SocketIOServer } from "socket.io";
import { FeedUpdateMessage } from "@/services/feed/real-time-feed.service";

export interface IRealtimeMessageHandler {
  /**
   * handle a specific feed update message type
   */
  handle(
    io: SocketIOServer,
    message: FeedUpdateMessage,
    channel?: string,
  ): Promise<void>;

  /**
   * the message type this handler supports
   */
  readonly messageType: string;
}
