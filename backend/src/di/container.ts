import "reflect-metadata";
import { container } from "tsyringe";

import User from "../models/user.model";
import Image, { Tag } from "../models/image.model";
import { Comment } from "../models/comment.model";
import { UserRepository } from "../repositories/user.repository";
import { ImageRepository } from "../repositories/image.repository";
import { TagRepository } from "../repositories/tag.repository";
import { CommentRepository } from "../repositories/comment.repository";
import { CloudinaryService } from "../services/cloudinary.service";
import { UserService } from "../services/user.service";
import { ImageService } from "../services/image.service";
import { CommentService } from "../services/comment.service";
import { UserController } from "../controllers/user.controller";
import { ImageController } from "../controllers/image.controller";
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
import { LikeActionCommand } from "../application/commands/users/likeAction/likeAction.command";
import { LikeActionCommandHandler } from "../application/commands/users/likeAction/likeAction.handler";

export function setupContainer(): void {
	registerCoreComponents();
	registerRepositories();
	registerServices();
	registerControllers();
	registerRoutes();
	registerCQRS();
	container.registerSingleton("Server", Server);
}

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
}

// Register CQRS components
function registerCQRS(): void {
	container.registerSingleton("CommandBus", CommandBus);
	container.registerSingleton("QueryBus", QueryBus);
	container.registerSingleton("EventBus", EventBus);

	// Register command handlers
	container.register("RegisterUserCommandHandler", { useClass: RegisterUserCommandHandler });
	container.register("LikeActionCommandHandler", { useClass: LikeActionCommandHandler });

	// Register query handlers
	container.register("GetMeQueryHandler", { useClass: GetMeQueryHandler });

	// Register interaction handlers
	container.register("FeedInteractionHandler", { useClass: FeedInteractionHandler });

	// Setup the buses
	const commandBus = container.resolve<CommandBus>("CommandBus");
	const queryBus = container.resolve<QueryBus>("QueryBus");
	const eventBus = container.resolve<EventBus>("EventBus");

	// Subscribe handlers
	eventBus.subscribe(UserInteractedWithImageEvent, container.resolve<FeedInteractionHandler>("FeedInteractionHandler"));

	// Register command handlers with command bus
	commandBus.register(RegisterUserCommand, container.resolve<RegisterUserCommandHandler>("RegisterUserCommandHandler"));
	commandBus.register(LikeActionCommand, container.resolve<LikeActionCommandHandler>("LikeActionCommandHandler"));

	// Register query handlers with query bus
	queryBus.register(GetMeQuery, container.resolve<GetMeQueryHandler>("GetMeQueryHandler"));
}
