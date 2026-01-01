import { container } from "tsyringe";

import { SearchController } from "../controllers/search.controller";
import { UserController } from "../controllers/user.controller";
import { ImageController } from "../controllers/image.controller";
import { PostController } from "../controllers/post.controller";
import { CommentController } from "../controllers/comment.controller";
import { NotificationController } from "../controllers/notification.controller";
import { AdminUserController } from "../controllers/admin.controller";
import { FeedController } from "../controllers/feed.controller";
import { FavoriteController } from "../controllers/favorite.controller";
import { MessagingController } from "../controllers/messaging.controller";
import { CommunityController } from "../controllers/community.controller";

export function registerControllers(): void {
	container.registerSingleton("SearchController", SearchController);
	container.registerSingleton("UserController", UserController);
	container.registerSingleton("ImageController", ImageController);
	container.registerSingleton("PostController", PostController);
	container.registerSingleton("CommentController", CommentController);
	container.registerSingleton("NotificationController", NotificationController);
	container.registerSingleton("AdminUserController", AdminUserController);
	container.registerSingleton("FeedController", FeedController);
	container.registerSingleton("FavoriteController", FavoriteController);
	container.registerSingleton("MessagingController", MessagingController);
	container.registerSingleton("CommunityController", CommunityController);
}
