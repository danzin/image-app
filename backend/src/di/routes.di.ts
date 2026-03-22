import { container } from "tsyringe";

import { UserRoutes } from "../routes/user.routes";
import { ImageRoutes } from "../routes/image.routes";
import { PostRoutes } from "../routes/post.routes";
import { CommentRoutes } from "../routes/comment.routes";
import { SearchRoutes } from "../routes/search.routes";
import { AdminUserRoutes } from "../routes/admin.routes";
import { NotificationRoutes } from "../routes/notification.routes";
import { FeedRoutes } from "../routes/feed.routes";
import { FavoriteRoutes } from "../routes/favorite.routes";
import { MessagingRoutes } from "../routes/messaging.routes";
import { MetricsRoutes } from "../routes/metrics.routes";
import { CommunityRoutes } from "../routes/community.routes";
import { TelemetryRoutes } from "../routes/telemetry.routes";
import { logger } from "@/utils/winston";
import { TOKENS } from "@/types/tokens";

export function registerRoutes(): void {
  container.registerSingleton(TOKENS.Routes.User, UserRoutes);
  container.registerSingleton(TOKENS.Routes.Image, ImageRoutes);
  container.registerSingleton(TOKENS.Routes.Post, PostRoutes);
  container.registerSingleton(TOKENS.Routes.Comment, CommentRoutes);
  container.registerSingleton(TOKENS.Routes.Search, SearchRoutes);
  container.registerSingleton(TOKENS.Routes.AdminUser, AdminUserRoutes);
  container.registerSingleton(TOKENS.Routes.Notification, NotificationRoutes);
  container.registerSingleton(TOKENS.Routes.Feed, FeedRoutes);
  container.registerSingleton(TOKENS.Routes.Favorite, FavoriteRoutes);
  container.registerSingleton(TOKENS.Routes.Messaging, MessagingRoutes);
  container.registerSingleton(TOKENS.Routes.Metrics, MetricsRoutes);
  container.registerSingleton(TOKENS.Routes.Community, CommunityRoutes);
  container.registerSingleton(TOKENS.Routes.Telemetry, TelemetryRoutes);

  logger.info("[di] Routes registered");
}
