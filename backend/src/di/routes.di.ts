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

export function registerRoutes(): void {
	container.registerSingleton("UserRoutes", UserRoutes);
	container.registerSingleton("ImageRoutes", ImageRoutes);
	container.registerSingleton("PostRoutes", PostRoutes);
	container.registerSingleton("CommentRoutes", CommentRoutes);
	container.registerSingleton("SearchRoutes", SearchRoutes);
	container.registerSingleton("AdminUserRoutes", AdminUserRoutes);
	container.registerSingleton("NotificationRoutes", NotificationRoutes);
	container.registerSingleton("FeedRoutes", FeedRoutes);
	container.registerSingleton("FavoriteRoutes", FavoriteRoutes);
	container.registerSingleton("MessagingRoutes", MessagingRoutes);
}
