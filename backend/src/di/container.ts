import "reflect-metadata";
import { container } from "tsyringe";

import User from "../models/user.model";
import Image, { Tag } from "../models/image.model";
import Post from "../models/post.model";
import PostLike from "../models/postLike.model";
import PostView from "../models/postView.model";
import { Comment } from "../models/comment.model";
import Favorite from "../models/favorite.model";
import Conversation from "../models/conversation.model";
import Message from "../models/message.model";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";
import { PostRepository } from "../repositories/post.repository";
import { PostLikeRepository } from "../repositories/postLike.repository";
import { PostViewRepository } from "../repositories/postView.repository";
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
import { PostController } from "../controllers/post.controller";
import { FavoriteController } from "../controllers/favorite.controller";
import { CommentController } from "../controllers/comment.controller";
import { SearchController } from "../controllers/search.controller";
import { NotificationController } from "../controllers/notification.controller";
import { AdminUserController } from "../controllers/admin.controller";
import { FeedController } from "../controllers/feed.controller";
import { MessagingController } from "../controllers/messaging.controller";
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
import { Server } from "../server/server";
import { UnitOfWork } from "../database/UnitOfWork";
import { SearchService } from "../services/search.service";
import { FollowService } from "../services/follow.service";
import Follow from "../models/follow.model";
import Notification from "../models/notification.model";
import { NotificationService } from "../services/notification.service";
import UserAction from "../models/userAction.model";
import { FollowRepository } from "../repositories/follow.repository";
import { UserActionRepository } from "../repositories/userAction.repository";
import { WebSocketServer } from "../server/socketServer";
import { DTOService } from "../services/dto.service";
import { UserPreference } from "../models/userPreference.model";
import { FeedService } from "../services/feed.service";
import { MessagingService } from "../services/messaging.service";
import { UserPreferenceRepository } from "../repositories/userPreference.repository";
import { RedisService } from "../services/redis.service";
import { TagService } from "../services/tag.service";
import { LocalStorageService } from "../services/localStorage.service";
import { IImageStorageService } from "../types/index";
import { CommandBus } from "../application/common/buses/command.bus";
import { QueryBus } from "../application/common/buses/query.bus";
import { RegisterUserCommandHandler } from "../application/commands/users/register/register.handler";
import { RegisterUserCommand } from "../application/commands/users/register/register.command";
import { GetMeQueryHandler } from "../application/queries/users/getMe/getMe.handler";
import { GetMeQuery } from "../application/queries/users/getMe/getMe.query";
import { GetWhoToFollowQueryHandler } from "../application/queries/users/getWhoToFollow/getWhoToFollow.handler";
import { GetWhoToFollowQuery } from "../application/queries/users/getWhoToFollow/getWhoToFollow.query";
import { GetTrendingTagsQueryHandler } from "../application/queries/tags/getTrendingTags/getTrendingTags.handler";
import { GetTrendingTagsQuery } from "../application/queries/tags/getTrendingTags/getTrendingTags.query";
import { EventBus } from "../application/common/buses/event.bus";
import { FeedInteractionHandler } from "../application/events/user/feed-interaction.handler";
import { UserInteractedWithPostEvent } from "../application/events/user/user-interaction.event";
import { PostDeletedEvent, PostUploadedEvent } from "../application/events/post/post.event";
import { LikeActionCommand } from "../application/commands/users/likeAction/likeAction.command";
import { LikeActionCommandHandler } from "../application/commands/users/likeAction/likeAction.handler";
import { LikeActionByPublicIdCommand } from "../application/commands/users/likeActionByPublicId/likeActionByPublicId.command";
import { LikeActionByPublicIdCommandHandler } from "../application/commands/users/likeActionByPublicId/likeActionByPublicId.handler";
import { PostUploadHandler } from "../application/events/post/post-uploaded.handler";
import { PostDeleteHandler } from "../application/events/post/post-deleted.handler";
import { UserAvatarChangedEvent } from "../application/events/user/user-interaction.event";
import { UserAvatarChangedHandler } from "../application/events/user/user-avatar-change.handler";
import { RealTimeFeedService } from "../services/real-time-feed.service";
import { CreateCommentCommand } from "../application/commands/comments/createComment/createComment.command";
import { CreateCommentCommandHandler } from "../application/commands/comments/createComment/create-comment.handler";
import { DeleteCommentCommand } from "../application/commands/comments/deleteComment/deleteComment.command";
import { DeleteCommentCommandHandler } from "../application/commands/comments/createComment/delete-comment.handler";
import { MessageSentHandler } from "../application/events/message/message-sent.handler";
import { MessageSentEvent } from "../application/events/message/message.event";
import { NotificationRepository } from "../repositories/notification.respository";
import { CreatePostCommand } from "../application/commands/post/createPost/createPost.command";
import { CreatePostCommandHandler } from "../application/commands/post/createPost/createPost.handler";
import { DeletePostCommand } from "../application/commands/post/deletePost/deletePost.command";
import { DeletePostCommandHandler } from "../application/commands/post/deletePost/deletePost.handler";
import { RecordPostViewCommand } from "../application/commands/post/recordPostView/recordPostView.command";
import { RecordPostViewCommandHandler } from "../application/commands/post/recordPostView/recordPostView.handler";
import { GetPersonalizedFeedQuery } from "../application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.query";
import { GetPersonalizedFeedQueryHandler } from "../application/queries/feed/getPersonalizedFeed/getPersonalizedFeed.handler";
import { GetPostByPublicIdQuery } from "../application/queries/post/getPostByPublicId/getPostByPublicId.query";
import { GetPostByPublicIdQueryHandler } from "../application/queries/post/getPostByPublicId/getPostByPublicId.handler";
import { GetPostBySlugQuery } from "../application/queries/post/getPostBySlug/getPostBySlug.query";
import { GetPostBySlugQueryHandler } from "../application/queries/post/getPostBySlug/getPostBySlug.handler";
import { GetPostsQuery } from "../application/queries/post/getPosts/getPosts.query";
import { GetPostsQueryHandler } from "../application/queries/post/getPosts/getPosts.handler";
import { GetPostsByUserQuery } from "../application/queries/post/getPostsByUser/getPostsByUser.query";
import { GetPostsByUserQueryHandler } from "../application/queries/post/getPostsByUser/getPostsByUser.handler";
import { SearchPostsByTagsQuery } from "../application/queries/post/searchPostsByTags/searchPostsByTags.query";
import { SearchPostsByTagsQueryHandler } from "../application/queries/post/searchPostsByTags/searchPostsByTags.handler";
import { GetAllTagsQuery } from "../application/queries/tags/getAllTags/getAllTags.query";
import { GetAllTagsQueryHandler } from "../application/queries/tags/getAllTags/getAllTags.handler";
import { NewPostMessageHandler } from "../application/handlers/realtime/NewPostMessageHandler";
import { GlobalNewPostMessageHandler } from "../application/handlers/realtime/GlobalNewPostMessageHandler";
import { PostDeletedMessageHandler } from "../application/handlers/realtime/PostDeletedMessageHandler";
import { InteractionMessageHandler } from "../application/handlers/realtime/InteractionMessageHandler";
import { LikeUpdateMessageHandler } from "../application/handlers/realtime/LikeUpdateMessageHandler";
import { AvatarUpdateMessageHandler } from "../application/handlers/realtime/AvatarUpdateMessageHandler";
import { MessageSentHandler as RealtimeMessageSentHandler } from "../application/handlers/realtime/MessageSentHandler";
import { GetForYouFeedQueryHandler } from "../application/queries/feed/getForYouFeed/getForYouFeed.handler";
import { GetForYouFeedQuery } from "../application/queries/feed/getForYouFeed/getForYouFeed.query";
import { GetTrendingFeedQueryHandler } from "../application/queries/feed/getTrendingFeed/getTrendingFeed.handler";
import { GetTrendingFeedQuery } from "../application/queries/feed/getTrendingFeed/getTrendingFeed.query";
import { UserActionService } from "../services/userAction.service";
import { DeleteUserCommand } from "../application/commands/users/deleteUser/deleteUser.command";
import { DeleteUserCommandHandler } from "../application/commands/users/deleteUser/deleteUser.handler";
import { UpdateAvatarCommand } from "../application/commands/users/updateAvatar/updateAvatar.command";
import { UpdateAvatarCommandHandler } from "../application/commands/users/updateAvatar/updateAvatar.handler";
import { UpdateCoverCommand } from "../application/commands/users/updateCover/updateCover.command";
import { UpdateCoverCommandHandler } from "../application/commands/users/updateCover/updateCover.handler";
import { UserCoverChangedEvent } from "../application/events/user/user-interaction.event";
import { UserCoverChangedHandler } from "../application/events/user/user-cover-change.handler";

export function setupContainerCore(): void {
	registerCoreComponents();
	registerRepositories();
	registerServices();
	registerControllers();
	registerRoutes();

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
	container.register("PostModel", { useValue: Post });
	container.register("PostLikeModel", { useValue: PostLike });
	container.register("PostViewModel", { useValue: PostView });
	container.register("TagModel", { useValue: Tag });
	container.register("CommentModel", { useValue: Comment });
	container.register("FollowModel", { useValue: Follow });
	container.register("NotificationModel", { useValue: Notification });
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
	container.registerSingleton("PostRepository", PostRepository);
	container.registerSingleton("PostLikeRepository", PostLikeRepository);
	container.registerSingleton("PostViewRepository", PostViewRepository);
	container.registerSingleton("CommentRepository", CommentRepository);
	container.registerSingleton("UserActionRepository", UserActionRepository);
	container.registerSingleton("TagRepository", TagRepository);
	container.registerSingleton("FollowRepository", FollowRepository);
	container.registerSingleton("NotificationRepository", NotificationRepository);
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
	container.registerSingleton("UserActionService", UserActionService);

	// register realtime message handlers
	const realtimeHandlers = [
		container.resolve(NewPostMessageHandler),
		container.resolve(GlobalNewPostMessageHandler),
		container.resolve(PostDeletedMessageHandler),
		container.resolve(InteractionMessageHandler),
		container.resolve(LikeUpdateMessageHandler),
		container.resolve(AvatarUpdateMessageHandler),
		container.resolve(RealtimeMessageSentHandler),
	];
	container.register("RealtimeHandlers", { useValue: realtimeHandlers });

	container.registerSingleton("RealTimeFeedService", RealTimeFeedService);
	container.registerSingleton("FavoriteService", FavoriteService);
	container.registerSingleton("MessagingService", MessagingService);
	container.registerSingleton("TagService", TagService);
}

// Register Controllers as singletons
function registerControllers(): void {
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
}

// Register Routes as singletons
function registerRoutes(): void {
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

// Register CQRS components
export function registerCQRS(): void {
	// Register buses
	container.registerSingleton("CommandBus", CommandBus);
	container.registerSingleton("QueryBus", QueryBus);
	container.registerSingleton("EventBus", EventBus);

	// Register handler classes as transient/registration tokens.
	// This only binds the class to a token without resolvin the handler yet
	container.register("RegisterUserCommandHandler", { useClass: RegisterUserCommandHandler });
	container.register("DeleteUserCommandHandler", { useClass: DeleteUserCommandHandler });
	container.register("UpdateAvatarCommandHandler", { useClass: UpdateAvatarCommandHandler });
	container.register("UpdateCoverCommandHandler", { useClass: UpdateCoverCommandHandler });
	container.register("LikeActionCommandHandler", { useClass: LikeActionCommandHandler });
	container.register("LikeActionByPublicIdCommandHandler", { useClass: LikeActionByPublicIdCommandHandler });
	container.register("CreateCommentCommandHandler", { useClass: CreateCommentCommandHandler });
	container.register("DeleteCommentCommandHandler", { useClass: DeleteCommentCommandHandler });
	container.register("CreatePostCommandHandler", { useClass: CreatePostCommandHandler });
	container.register("DeletePostCommandHandler", { useClass: DeletePostCommandHandler });
	container.register("RecordPostViewCommandHandler", { useClass: RecordPostViewCommandHandler });

	// Reactive event handlers
	container.register("PostUploadHandler", { useClass: PostUploadHandler });
	container.register("PostDeleteHandler", { useClass: PostDeleteHandler });
	container.register("UserAvatarChangedHandler", { useClass: UserAvatarChangedHandler });
	container.register("UserCoverChangedHandler", { useClass: UserCoverChangedHandler });

	// Query handlers
	container.register("GetMeQueryHandler", { useClass: GetMeQueryHandler });
	container.register("GetWhoToFollowQueryHandler", { useClass: GetWhoToFollowQueryHandler });
	container.register("GetTrendingTagsQueryHandler", { useClass: GetTrendingTagsQueryHandler });
	container.register("GetPersonalizedFeedQueryHandler", { useClass: GetPersonalizedFeedQueryHandler });
	container.register("GetForYouFeedQueryHandler", { useClass: GetForYouFeedQueryHandler });
	container.register("GetTrendingFeedQueryHandler", { useClass: GetTrendingFeedQueryHandler });
	container.register("GetPostByPublicIdQueryHandler", { useClass: GetPostByPublicIdQueryHandler });
	container.register("GetPostBySlugQueryHandler", { useClass: GetPostBySlugQueryHandler });
	container.register("GetPostsQueryHandler", { useClass: GetPostsQueryHandler });
	container.register("GetPostsByUserQueryHandler", { useClass: GetPostsByUserQueryHandler });
	container.register("SearchPostsByTagsQueryHandler", { useClass: SearchPostsByTagsQueryHandler });
	container.register("GetAllTagsQueryHandler", { useClass: GetAllTagsQueryHandler });

	// Interaction handlers (token-only registration)
	container.register("FeedInteractionHandler", { useClass: FeedInteractionHandler });
	container.register("MessageSentHandler", { useClass: MessageSentHandler });
}

export function initCQRS(): void {
	const commandBus = container.resolve<CommandBus>("CommandBus");
	const queryBus = container.resolve<QueryBus>("QueryBus");
	const eventBus = container.resolve<EventBus>("EventBus");

	// Resolve handler instances (they will be constructed now)
	commandBus.register(RegisterUserCommand, container.resolve<RegisterUserCommandHandler>("RegisterUserCommandHandler"));
	commandBus.register(DeleteUserCommand, container.resolve<DeleteUserCommandHandler>("DeleteUserCommandHandler"));
	commandBus.register(UpdateAvatarCommand, container.resolve<UpdateAvatarCommandHandler>("UpdateAvatarCommandHandler"));
	commandBus.register(UpdateCoverCommand, container.resolve<UpdateCoverCommandHandler>("UpdateCoverCommandHandler"));
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
	commandBus.register(CreatePostCommand, container.resolve<CreatePostCommandHandler>("CreatePostCommandHandler"));
	commandBus.register(DeletePostCommand, container.resolve<DeletePostCommandHandler>("DeletePostCommandHandler"));
	commandBus.register(
		RecordPostViewCommand,
		container.resolve<RecordPostViewCommandHandler>("RecordPostViewCommandHandler")
	);

	// Register event handlers
	eventBus.subscribe(UserInteractedWithPostEvent, container.resolve<FeedInteractionHandler>("FeedInteractionHandler"));
	eventBus.subscribe(PostUploadedEvent, container.resolve<PostUploadHandler>("PostUploadHandler"));
	eventBus.subscribe(PostDeletedEvent, container.resolve<PostDeleteHandler>("PostDeleteHandler"));
	eventBus.subscribe(UserAvatarChangedEvent, container.resolve<UserAvatarChangedHandler>("UserAvatarChangedHandler"));
	eventBus.subscribe(UserCoverChangedEvent, container.resolve<UserCoverChangedHandler>("UserCoverChangedHandler"));
	eventBus.subscribe(MessageSentEvent, container.resolve<MessageSentHandler>("MessageSentHandler"));

	// Register queries
	queryBus.register(GetMeQuery, container.resolve<GetMeQueryHandler>("GetMeQueryHandler"));
	queryBus.register(GetWhoToFollowQuery, container.resolve<GetWhoToFollowQueryHandler>("GetWhoToFollowQueryHandler"));
	queryBus.register(
		GetTrendingTagsQuery,
		container.resolve<GetTrendingTagsQueryHandler>("GetTrendingTagsQueryHandler")
	);
	queryBus.register(
		GetPersonalizedFeedQuery,
		container.resolve<GetPersonalizedFeedQueryHandler>("GetPersonalizedFeedQueryHandler")
	);
	queryBus.register(GetForYouFeedQuery, container.resolve<GetForYouFeedQueryHandler>("GetForYouFeedQueryHandler"));
	queryBus.register(
		GetTrendingFeedQuery,
		container.resolve<GetTrendingFeedQueryHandler>("GetTrendingFeedQueryHandler")
	);
	queryBus.register(
		GetPostByPublicIdQuery,
		container.resolve<GetPostByPublicIdQueryHandler>("GetPostByPublicIdQueryHandler")
	);
	queryBus.register(GetPostBySlugQuery, container.resolve<GetPostBySlugQueryHandler>("GetPostBySlugQueryHandler"));
	queryBus.register(GetPostsQuery, container.resolve<GetPostsQueryHandler>("GetPostsQueryHandler"));
	queryBus.register(GetPostsByUserQuery, container.resolve<GetPostsByUserQueryHandler>("GetPostsByUserQueryHandler"));
	queryBus.register(
		SearchPostsByTagsQuery,
		container.resolve<SearchPostsByTagsQueryHandler>("SearchPostsByTagsQueryHandler")
	);
	queryBus.register(GetAllTagsQuery, container.resolve<GetAllTagsQueryHandler>("GetAllTagsQueryHandler"));

	// Resolve and register realtime handlers array
	const realtimeHandlers = [
		container.resolve(NewPostMessageHandler),
		container.resolve(GlobalNewPostMessageHandler),
		container.resolve(PostDeletedMessageHandler),
		container.resolve(InteractionMessageHandler),
		container.resolve(LikeUpdateMessageHandler),
		container.resolve(AvatarUpdateMessageHandler),
		container.resolve(RealtimeMessageSentHandler),
	];
	container.register("RealtimeHandlers", { useValue: realtimeHandlers });

	console.info("[di] CQRS initialized (handlers resolved)");
}
