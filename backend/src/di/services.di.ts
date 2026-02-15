import { container } from "tsyringe";

import { CloudinaryService } from "@/services/cloudinary.service";
import { AuthService } from "@/services/auth.service";
import { ImageService } from "@/services/image.service";
import { CommentService } from "@/services/comment.service";
import { FollowService } from "@/services/follow.service";
import { NotificationService } from "@/services/notification.service";
import { DTOService } from "@/services/dto.service";
import { FeedService } from "@/services/feed.service";
import { RedisService } from "@/services/redis.service";
import { UserActionService } from "@/services/userAction.service";
import { RealTimeFeedService } from "@/services/real-time-feed.service";
import { FavoriteService } from "@/services/favorite.service";
import { MessagingService } from "@/services/messaging.service";
import { TagService } from "@/services/tag.service";
import { LocalStorageService } from "@/services/localStorage.service";
import { UserActivityService } from "@/services/user-activity.service";
import { IImageStorageService } from "@/types";
import { NewPostMessageHandler } from "@/application/handlers/realtime/NewPostMessageHandler";
import { GlobalNewPostMessageHandler } from "@/application/handlers/realtime/GlobalNewPostMessageHandler";
import { PostDeletedMessageHandler } from "@/application/handlers/realtime/PostDeletedMessageHandler";
import { InteractionMessageHandler } from "@/application/handlers/realtime/InteractionMessageHandler";
import { LikeUpdateMessageHandler } from "@/application/handlers/realtime/LikeUpdateMessageHandler";
import { AvatarUpdateMessageHandler } from "@/application/handlers/realtime/AvatarUpdateMessageHandler";
import { MessageSentHandler as RealtimeMessageSentHandler } from "@/application/handlers/realtime/MessageSentHandler";
import { MessageStatusUpdatedHandler as RealtimeMessageStatusUpdatedHandler } from "@/application/handlers/realtime/MessageStatusUpdatedHandler";
import { SearchService } from "@/services/search.service";
import { logger } from "@/utils/winston";
import { MetricsService } from "../metrics/metrics.service";
import { RetryService } from "@/services/retry.service";
import { TransactionQueueService } from "@/services/transaction-queue.service";
import { TelemetryService } from "@/services/telemetry.service";
import { EmailService } from "@/services/email.service";
import { FeedEnrichmentService } from "@/services/feed-enrichment.service";
import { AuthSessionService } from "@/services/auth-session.service";
import { BloomFilterService } from "@/services/bloom-filter.service";

export function registerServices(): void {
	const isCloudinaryConfigured =
		process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

	const ImageStorageService = isCloudinaryConfigured ? CloudinaryService : LocalStorageService;
	if (!isCloudinaryConfigured) {
		logger.info("No Cloudinary credentials detected. \r\nDefaulting to local storage.");
	}

	container.registerSingleton("MetricsService", MetricsService);
	container.registerSingleton("TelemetryService", TelemetryService);
	container.registerSingleton("SearchService", SearchService);
	container.registerSingleton("AuthService", AuthService);
	container.registerSingleton("AuthSessionService", AuthSessionService);
	container.registerSingleton("BloomFilterService", BloomFilterService);
	container.registerSingleton("ImageService", ImageService);
	container.registerSingleton("CommentService", CommentService);
	container.registerSingleton("FollowService", FollowService);
	container.registerSingleton("NotificationService", NotificationService);
	container.registerSingleton<IImageStorageService>("ImageStorageService", ImageStorageService);
	container.registerSingleton("DTOService", DTOService);
	container.registerSingleton("FeedEnrichmentService", FeedEnrichmentService);
	container.registerSingleton("FeedService", FeedService);
	container.registerSingleton("RedisService", RedisService);
	container.registerSingleton("UserActionService", UserActionService);
	container.registerSingleton("UserActivityService", UserActivityService);
	container.registerSingleton("RetryService", RetryService);
	container.registerSingleton("TransactionQueueService", TransactionQueueService);
	container.registerSingleton("EmailService", EmailService);

	const realtimeHandlers = [
		container.resolve(NewPostMessageHandler),
		container.resolve(GlobalNewPostMessageHandler),
		container.resolve(PostDeletedMessageHandler),
		container.resolve(InteractionMessageHandler),
		container.resolve(LikeUpdateMessageHandler),
		container.resolve(AvatarUpdateMessageHandler),
		container.resolve(RealtimeMessageSentHandler),
		container.resolve(RealtimeMessageStatusUpdatedHandler),
	];
	container.register("RealtimeHandlers", { useValue: realtimeHandlers });

	container.registerSingleton("RealTimeFeedService", RealTimeFeedService);
	container.registerSingleton("FavoriteService", FavoriteService);
	container.registerSingleton("MessagingService", MessagingService);
	container.registerSingleton("TagService", TagService);
}
