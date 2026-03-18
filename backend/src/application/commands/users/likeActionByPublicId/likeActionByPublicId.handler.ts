import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionByPublicIdCommand } from "./likeActionByPublicId.command";
import { IPost, PostDTO, PopulatedPostUser, PopulatedPostTag } from "@/types/index";
import { EventBus } from "@/application/common/buses/event.bus";
import { UserInteractedWithPostEvent } from "@/application/events/user/user-interaction.event";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { PostLikeRepository } from "@/repositories/postLike.repository";
import { UserActionRepository } from "@/repositories/userAction.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { NotificationRequestedEvent } from "@/application/events/notification/notification.event";
import { NotificationRequestedHandler } from "@/application/events/notification/notification-requested.handler";
import { DTOService } from "@/services/dto.service";
import { createError , wrapError } from "@/utils/errors";
import { FeedInteractionHandler } from "@/application/events/user/feed-interaction.handler";
import { ClientSession, Types } from "mongoose";
import { UnitOfWork } from "@/database/UnitOfWork";
import { logger } from "@/utils/winston";
import { TOKENS } from "@/types/tokens";

@injectable()
export class LikeActionByPublicIdCommandHandler implements ICommandHandler<LikeActionByPublicIdCommand, PostDTO> {
	constructor(
		@inject(TOKENS.Repositories.UnitOfWork) private readonly unitOfWork: UnitOfWork,
		@inject(TOKENS.Repositories.PostRead) private readonly postReadRepository: IPostReadRepository,
		@inject(TOKENS.Repositories.PostWrite) private readonly postWriteRepository: IPostWriteRepository,
		@inject(TOKENS.Repositories.PostLike) private readonly postLikeRepository: PostLikeRepository,
		@inject(TOKENS.Repositories.UserAction) private readonly userActionRepository: UserActionRepository,
		@inject(TOKENS.Repositories.UserRead) private readonly userReadRepository: IUserReadRepository,
		@inject(TOKENS.CQRS.Handlers.EventBus) private readonly eventBus: EventBus,
		@inject(TOKENS.CQRS.Handlers.NotificationRequested)
		private readonly notificationRequestedHandler: NotificationRequestedHandler,
		@inject(TOKENS.CQRS.Handlers.FeedInteraction) private readonly feedInteractionHandler: FeedInteractionHandler,
		@inject(TOKENS.Services.DTO) private readonly dtoService: DTOService
	) {}

	async execute(command: LikeActionByPublicIdCommand): Promise<PostDTO> {
		let isLikeAction = true;
		let postTags: string[] = [];
		let existingPost: IPost | null;
		let userMongoId: string;

		try {
			logger.info(
				`[LIKEACTIONHANDLER]:\r\n  User public ID: ${command.userPublicId},
			 Post public ID: ${command.postPublicId} \r\n command: ${JSON.stringify(command)}`
			);
			const user = await this.userReadRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("PathError", `User with public ID ${command.userPublicId} not found`);
			}
			// Get MongoDB _id from user document - handle both raw and transformed
			userMongoId = user._id?.toString() ?? user.id?.toString();

			if (!userMongoId) {
				throw createError("PathError", `User internal ID not found for public ID ${command.userPublicId}`);
			}

			logger.info("[LIKEACTIONHANDLER] user keys:", Object.keys(user));
			logger.info("[LIKEACTIONHANDLER] user._id:", user._id);
			logger.info("[LIKEACTIONHANDLER] user.username:", user.username);

			const actorUsername = user.username || "Unknown";
			const actorHandle = user.handle;
			const actorAvatar = user.avatar;

			existingPost = await this.postReadRepository.findByPublicId(command.postPublicId);
			if (!existingPost) {
				throw createError("PathError", `Post with public ID ${command.postPublicId} not found`);
			}

			logger.info("[LIKEACTIONHANDLER] existingPost keys:", Object.keys(existingPost));
			logger.info("[LIKEACTIONHANDLER] existingPost._id:", existingPost._id);
			logger.info("[LIKEACTIONHANDLER] existingPost.id:", existingPost.id);

			postTags = Array.isArray(existingPost.tags)
				? (existingPost.tags as (Types.ObjectId | PopulatedPostTag)[]).map(
						(t) => (typeof t === "object" && "tag" in t ? (t as PopulatedPostTag).tag : t.toString())
					)
				: [];

			// Get _id from the document to handle both Mongoose document and plain object
			const postInternalId = existingPost._id?.toString() ?? existingPost.id?.toString() ?? null;

			if (!postInternalId) {
				logger.error("[LIKEACTIONHANDLER] Post object:", { post: existingPost });
				throw createError("PathError", `Post internal ID not found for public ID ${command.postPublicId}`);
			}

			const postOwner = existingPost.user as Types.ObjectId | PopulatedPostUser;
			let postOwnerPublicId = "";
			if (typeof postOwner === "object" && "publicId" in postOwner) {
				postOwnerPublicId = (postOwner as PopulatedPostUser).publicId ?? "";
			} else if (postOwner) {
				const ownerUser = await this.userReadRepository.findById(postOwner.toString());
				if (ownerUser) {
					postOwnerPublicId = ownerUser.publicId;
				}
			}

			await this.unitOfWork.executeInTransaction(async (session) => {
				const existingLike = await this.postLikeRepository.hasUserLiked(postInternalId, userMongoId, session);

				if (existingLike) {
					await this.handleUnlike(command, userMongoId, postInternalId, session);
					isLikeAction = false;
				} else {
					await this.handleLike(command, userMongoId, existingPost!, actorUsername, actorHandle, actorAvatar, postOwnerPublicId, session);
				}
				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(
						command.userPublicId,
						isLikeAction ? "like" : "unlike",
						existingPost!.publicId,
						postTags,
						postOwnerPublicId
					),
					this.feedInteractionHandler
				);
			});

			const updatedPost = await this.postReadRepository.findByPublicId(command.postPublicId);
			if (!updatedPost) {
				throw createError("PathError", `Post with public ID ${command.postPublicId} not found after update`);
			}

			return this.dtoService.toPostDTO(updatedPost);
		} catch (error) {
			throw wrapError(error, "InternalServerError", {
				context: { operation: "LikeActionByPublicId", userId: command.userPublicId, postPublicId: command.postPublicId },
			});
		}
	}

	private async handleLike(
		command: LikeActionByPublicIdCommand,
		userMongoId: string,
		post: IPost,
		actorUsername: string,
		actorHandle: string | undefined,
		actorAvatar: string | undefined,
		postOwnerPublicId: string,
		session: ClientSession
	) {
		const postId = post._id?.toString();
		const added = await this.postLikeRepository.addLike(postId, userMongoId, session);
		if (!added) {
			throw createError("ConflictError", "like already exists for user and post");
		}

		await this.postWriteRepository.updateLikeCount(postId, 1, session);

		await this.userActionRepository.logAction(userMongoId, "like", post._id?.toString(), session);

		if (postOwnerPublicId && postOwnerPublicId !== command.userPublicId) {
			const postPreview = post.body
				? post.body.substring(0, 50) + (post.body.length > 50 ? "..." : "")
				: post.image
					? "[Image post]"
					: "[Post]";

			this.eventBus.queueTransactional(
				new NotificationRequestedEvent({
					receiverId: postOwnerPublicId,
					actionType: "like",
					actorId: command.userPublicId,
					actorUsername,
					actorHandle,
					actorAvatar,
					targetId: post.publicId,
					targetType: "post",
					targetPreview: postPreview,
				}),
				this.notificationRequestedHandler,
			);
		}
	}

	private async handleUnlike(
		command: LikeActionByPublicIdCommand,
		userMongoId: string,
		postId: string,
		session: ClientSession
	) {
		const removed = await this.postLikeRepository.removeLike(postId, userMongoId, session);
		if (!removed) {
			throw createError("NotFoundError", "like does not exist for user and post");
		}
		await this.userActionRepository.logAction(userMongoId, "unlike", postId, session);
		await this.postWriteRepository.updateLikeCount(postId, -1, session);
	}
}
