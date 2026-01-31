import { container } from "tsyringe";

import User from "@/models/user.model";
import Image, { Tag } from "@/models/image.model";
import Post from "@/models/post.model";
import PostLike from "@/models/postLike.model";
import PostView from "@/models/postView.model";
import { Comment } from "@/models/comment.model";
import { CommentLike } from "@/models/commentLike.model";
import Favorite from "@/models/favorite.model";
import Conversation from "@/models/conversation.model";
import Message from "@/models/message.model";
import Follow from "@/models/follow.model";
import Notification from "@/models/notification.model";
import UserAction from "@/models/userAction.model";
import { UserPreference } from "@/models/userPreference.model";
import { WebSocketServer } from "../server/socketServer";

export function registerCoreComponents(): void {
	container.register("UserModel", { useValue: User });
	container.register("ImageModel", { useValue: Image });
	container.register("PostModel", { useValue: Post });
	container.register("PostLikeModel", { useValue: PostLike });
	container.register("PostViewModel", { useValue: PostView });
	container.register("TagModel", { useValue: Tag });
	container.register("CommentModel", { useValue: Comment });
	container.register("CommentLikeModel", { useValue: CommentLike });
	container.register("FollowModel", { useValue: Follow });
	container.register("NotificationModel", { useValue: Notification });
	container.register("UserActionModel", { useValue: UserAction });
	container.register("UserPreferenceModel", { useValue: UserPreference });
	container.register("FavoriteModel", { useValue: Favorite });
	container.register("ConversationModel", { useValue: Conversation });
	container.register("MessageModel", { useValue: Message });
	container.registerSingleton("WebSocketServer", WebSocketServer);
}
