import "reflect-metadata";
import { container } from "tsyringe";

import User from "../models/user.model";
import Image, { Tag } from "../models/image.model";
import { Comment } from "../models/comment.model";
import Favorite from "../models/favorite.model";
import Conversation from "../models/conversation.model";
import Message from "../models/message.model";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";
import { TagRepository } from "../repositories/tag.repository";
import { CommentRepository } from "../repositories/comment.repository";
import { FavoriteRepository } from "../repositories/favorite.repository";
import { ConversationRepository } from "../repositories/conversation.repository";
import { MessageRepository } from "../repositories/message.repository";
import { CloudinaryService } from "../services/cloudinary.service";
import { UserService } from "../services/user.service";
import { ImageService } from "../services/image.service";
import { FavoriteService } from "../services/favorite.service";
import { CommentService } from "../services/comment.service";
import { UserController } from "../controllers/user.controller";
import { ImageController } from "../controllers/image.controller";
import { FavoriteController } from "../controllers/favorite.controller";
import { CommentController } from "../controllers/comment.controller";
import { UserRoutes } from "../routes/user.routes";
import { ImageRoutes } from "../routes/image.routes";
import { CommentRoutes } from "../routes/comment.routes";
import { Server } from "../server/server";
import { UnitOfWork } from "../database/UnitOfWork";
import { SearchService } from "../services/search.service";
import { SearchController } from "../controllers/search.controller";
import { FollowService } from "../services/follow.service";
import Follow from "../models/follow.model";
import { NotificationRepository } from "../repositories/notification.respository";
import Notification from "../models/notification.model";
import { NotificationService } from "../services/notification.service";
import { NotificationController } from "../controllers/notification.controller";
import { SearchRoutes } from "../routes/search.routes";
import Like from "../models/like.model";
import { LikeRepository } from "../repositories/like.repository";
import UserAction from "../models/userAction.model";
import { FollowRepository } from "../repositories/follow.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { WebSocketServer } from "../server/socketServer";
import { DTOService } from "../services/dto.service";
import { AdminUserRoutes } from "../routes/admin.routes";
import { AdminUserController } from "../controllers/admin.controller";
import { NotificationRoutes } from "../routes/notification.routes";
import { UserPreference } from "../models/userPreference.model";
import { FeedService } from "../services/feed.service";
import { FeedController } from "../controllers/feed.controller";
import { FeedRoutes } from "../routes/feed.routes";
import { FavoriteRoutes } from "../routes/favorite.routes";
import { MessagingService } from "../services/messaging.service";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { RedisService } from "../services/redis.service";
import { LocalStorageService } from "../services/localStorage.service";
import { IImageStorageService } from "../types/index";
import { CommandBus } from "../application/common/buses/command.bus";
import { QueryBus } from "../application/common/buses/query.bus";
import { RegisterUserCommandHandler } from "../application/commands/users/register/register.handler";
import { RegisterUserCommand } from "../application/commands/users/register/register.command";
import { GetMeQueryHandler } from "../application/queries/users/getMe/getMe.handler";
import { GetMeQuery } from "../application/queries/users/getMe/getMe.query";
import { EventBus } from "../application/common/buses/event.bus";
import { FeedInteractionHandler } from "../application/events/feed/feed-interaction.handler";
import { UserInteractedWithImageEvent } from "../application/events/user/user-interaction.event";
import { ImageDeletedEvent, ImageUploadedEvent } from "../application/events/image/image.event";
import { LikeActionCommand } from "../application/commands/users/likeAction/likeAction.command";
import { LikeActionCommandHandler } from "../application/commands/users/likeAction/likeAction.handler";
import { LikeActionByPublicIdCommand } from "../application/commands/users/likeActionByPublicId/likeActionByPublicId.command";
import { LikeActionByPublicIdCommandHandler } from "../application/commands/users/likeActionByPublicId/likeActionByPublicId.handler";
import { ImageUploadHandler } from "../application/events/image/image-upload.handler";
import { ImageDeleteHandler } from "../application/events/image/image-delete.handler";
import { UserAvatarChangedEvent } from "../application/events/user/user-interaction.event";
import { UserAvatarChangedHandler } from "../application/events/user/user-avatar-change.handler";
import { RealTimeFeedService } from "../services/real-time-feed.service";
import { CreateCommentCommand } from "../application/commands/comments/createComment/createComment.command";
import { CreateCommentCommandHandler } from "../application/commands/comments/createComment/createComment.handler";
import { DeleteCommentCommand } from "../application/commands/comments/deleteComment/deleteComment.command";
import { DeleteCommentCommandHandler } from "../application/commands/comments/deleteComment/deleteComment.handler";
import { MessageSentHandler } from "../application/events/message/message-sent.handler";
import { MessageSentEvent } from "../application/events/message/message.event";

export function setupContainer(): void {
	registerCoreComponents();
	registerRepositories();
	registerServices();
	registerControllers();
	registerRoutes();
	registerCQRS();
	container.registerSingleton("Server", Server);
}

// container.register("X", { useValue: value }) binds an existing value and is
// great for things like models or config objects that are effectively singletons anyway

// container.registerSingleton(...) binds a class as a singleton aka the same instance
// is returned each time it is resolved.
// Great for repositories, servvices, buses, controllers etc
// because these are expensive to create, hold resources/connections/state/cache etc
// and must be single source of truth across the app

// container.register("Token", { useClass: HandlerClass }) binds a class as transient
// aka a new instance is created each time it is resolved
// Great for things like command/query/event handlers that may hold
// per-request state like sessions

function registerCoreComponents(): void {
	container.register("UserModel", { useValue: User });
	container.register("ImageModel", { useValue: Image });
	container.register("TagModel", { useValue: Tag });
	container.register("CommentModel", { useValue: Comment });
	container.register("FollowModel", { useValue: Follow });
	container.register("NotificationModel", { useValue: Notification });
	container.register("LikeModel", { useValue: Like });
	container.register("UserActionModel", { useValue: UserAction });
	container.register("UserPreferenceModel", { useValue: UserPreference });
	container.register("FavoriteModel", { useValue: Favorite });
	container.register("ConversationModel", { useValue: Conversation });
	container.register("MessageModel", { useValue: Message });
	container.registerSingleton("WebSocketServer", WebSocketServer);
}

// Register Repositories
function registerRepositories(): void {
	container.registerSingleton("UnitOfWork", UnitOfWork);
	container.registerSingleton("UserRepository", UserRepository);
	container.registerSingleton("ImageRepository", ImageRepository);
	container.registerSingleton("CommentRepository", CommentRepository);
	container.registerSingleton("UserActionRepository", UserActionRepository);
	container.registerSingleton("TagRepository", TagRepository);
	container.registerSingleton("FollowRepository", FollowRepository);
	container.registerSingleton("NotificationRepository", NotificationRepository);
	container.registerSingleton("LikeRepository", LikeRepository);
	container.registerSingleton("UserPreferenceRepository", UserPreferenceRepository);
	container.registerSingleton("FavoriteRepository", FavoriteRepository);
	container.registerSingleton("ConversationRepository", ConversationRepository);
	container.registerSingleton("MessageRepository", MessageRepository);
}

// Register Services
function registerServices(): void {
	// Check if Cloudinary is configured
	const isCloudinaryConfigured =
		process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET;

	const ImageStorageService = isCloudinaryConfigured ? CloudinaryService : LocalStorageService;
	if (!isCloudinaryConfigured) {
		console.log("No Cloudinary credentials detected. \r\nDefaulting to local storage.");
	}

	container.registerSingleton("SearchService", SearchService);
	container.registerSingleton("UserService", UserService);
	container.registerSingleton("ImageService", ImageService);
	container.registerSingleton("CommentService", CommentService);
	container.registerSingleton("FollowService", FollowService);
	container.registerSingleton("NotificationService", NotificationService);
	container.registerSingleton<IImageStorageService>("ImageStorageService", ImageStorageService);
	container.registerSingleton("DTOService", DTOService);
	container.registerSingleton("FeedService", FeedService);
	container.registerSingleton("RedisService", RedisService);
	container.registerSingleton("RealTimeFeedService", RealTimeFeedService);
	container.registerSingleton("FavoriteService", FavoriteService);
	container.registerSingleton("MessagingService", MessagingService);
}

// Register Controllers as singletons
function registerControllers(): void {
	container.registerSingleton("SearchController", SearchController);
	container.registerSingleton("UserController", UserController);
	container.registerSingleton("ImageController", ImageController);
	container.registerSingleton("CommentController", CommentController);
	container.registerSingleton("NotificationController", NotificationController);
	container.registerSingleton("AdminUserController", AdminUserController);
	container.registerSingleton("FeedController", FeedController);
	container.registerSingleton("FavoriteController", FavoriteController);
}

// Register Routes as singletons
function registerRoutes(): void {
	container.registerSingleton("UserRoutes", UserRoutes);
	container.registerSingleton("ImageRoutes", ImageRoutes);
	container.registerSingleton("CommentRoutes", CommentRoutes);
	container.registerSingleton("SearchRoutes", SearchRoutes);
	container.registerSingleton("AdminUserRoutes", AdminUserRoutes);
	container.registerSingleton("NotificationRoutes", NotificationRoutes);
	container.registerSingleton("FeedRoutes", FeedRoutes);
	container.registerSingleton("FavoriteRoutes", FavoriteRoutes);
}

// Register CQRS components
function registerCQRS(): void {
	container.registerSingleton("CommandBus", CommandBus);
	container.registerSingleton("QueryBus", QueryBus);
	container.registerSingleton("EventBus", EventBus);

	// Register command handlers
	container.register("RegisterUserCommandHandler", { useClass: RegisterUserCommandHandler });
	container.register("LikeActionCommandHandler", { useClass: LikeActionCommandHandler });
	container.register("LikeActionByPublicIdCommandHandler", { useClass: LikeActionByPublicIdCommandHandler });
	container.register("CreateCommentCommandHandler", { useClass: CreateCommentCommandHandler });
	container.register("DeleteCommentCommandHandler", { useClass: DeleteCommentCommandHandler });

	// Register reactive event handlers
	container.register("ImageUploadHandler", { useClass: ImageUploadHandler });
	container.register("ImageDeleteHandler", { useClass: ImageDeleteHandler });
	container.register("UserAvatarChangedHandler", { useClass: UserAvatarChangedHandler });
	// Register query handlers
	container.register("GetMeQueryHandler", { useClass: GetMeQueryHandler });

	// Register interaction handlers
	container.register("FeedInteractionHandler", { useClass: FeedInteractionHandler });
	container.register("MessageSentHandler", { useClass: MessageSentHandler });

	// Setup the buses
	const commandBus = container.resolve<CommandBus>("CommandBus");
	const queryBus = container.resolve<QueryBus>("QueryBus");
	const eventBus = container.resolve<EventBus>("EventBus");

	// Subscribe handlers
	eventBus.subscribe(UserInteractedWithImageEvent, container.resolve<FeedInteractionHandler>("FeedInteractionHandler"));
	eventBus.subscribe(ImageUploadedEvent, container.resolve<ImageUploadHandler>("ImageUploadHandler"));
	eventBus.subscribe(ImageDeletedEvent, container.resolve<ImageDeleteHandler>("ImageDeleteHandler"));
	eventBus.subscribe(UserAvatarChangedEvent, container.resolve<UserAvatarChangedHandler>("UserAvatarChangedHandler"));
	eventBus.subscribe(MessageSentEvent, container.resolve<MessageSentHandler>("MessageSentHandler"));

	// Register command handlers with command bus
	commandBus.register(RegisterUserCommand, container.resolve<RegisterUserCommandHandler>("RegisterUserCommandHandler"));
	commandBus.register(LikeActionCommand, container.resolve<LikeActionCommandHandler>("LikeActionCommandHandler"));
	commandBus.register(
		LikeActionByPublicIdCommand,
		container.resolve<LikeActionByPublicIdCommandHandler>("LikeActionByPublicIdCommandHandler")
	);
	commandBus.register(
		CreateCommentCommand,
		container.resolve<CreateCommentCommandHandler>("CreateCommentCommandHandler")
	);

	commandBus.register(
		DeleteCommentCommand,
		container.resolve<DeleteCommentCommandHandler>("DeleteCommentCommandHandler")
	);

	// Register query handlers with query bus
	queryBus.register(GetMeQuery, container.resolve<GetMeQueryHandler>("GetMeQueryHandler"));
}
