import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionByPublicIdCommand } from "./likeActionByPublicId.command";
import { IPost, PostDTO } from "@/types/index";
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
import { createError } from "@/utils/errors";
import { FeedInteractionHandler } from "@/application/events/user/feed-interaction.handler";
import { ClientSession } from "mongoose";
import { UnitOfWork } from "@/database/UnitOfWork";
import { logger } from "@/utils/winston";

@injectable()
export class LikeActionByPublicIdCommandHandler implements ICommandHandler<LikeActionByPublicIdCommand, PostDTO> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("NotificationRequestedHandler")
		private readonly notificationRequestedHandler: NotificationRequestedHandler,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler,
		@inject("DTOService") private readonly dtoService: DTOService
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
			userMongoId = (user as any)._id ? (user as any)._id.toString() : (user as any).id?.toString();

			if (!userMongoId) {
				throw createError("PathError", `User internal ID not found for public ID ${command.userPublicId}`);
			}

			logger.info("[LIKEACTIONHANDLER] user keys:", Object.keys(user));
			logger.info("[LIKEACTIONHANDLER] user._id:", (user as any)._id);
			logger.info("[LIKEACTIONHANDLER] user.username:", (user as any).username);

			const actorUsername = (user as any).username || (user as any).name || "Unknown";
			const actorHandle = (user as any).handle;
			const actorAvatar = (user as any).avatar;

			existingPost = await this.postReadRepository.findByPublicId(command.postPublicId);
			if (!existingPost) {
				throw createError("PathError", `Post with public ID ${command.postPublicId} not found`);
			}

			logger.info("[LIKEACTIONHANDLER] existingPost keys:", Object.keys(existingPost));
			logger.info("[LIKEACTIONHANDLER] existingPost._id:", (existingPost as any)._id);
			logger.info("[LIKEACTIONHANDLER] existingPost.id:", (existingPost as any).id);

			postTags = Array.isArray((existingPost as any).tags)
				? (existingPost as any).tags.map((t: any) => t.tag ?? t)
				: [];

			// Get _id from the document to handle both Mongoose document and plain object
			const postInternalId = (existingPost as any)._id
				? (existingPost as any)._id.toString()
				: (existingPost as any).id?.toString() || null;

			if (!postInternalId) {
				console.error("[LIKEACTIONHANDLER] Post object:", existingPost);
				throw createError("PathError", `Post internal ID not found for public ID ${command.postPublicId}`);
			}

			const postOwner = (existingPost as any).user;
			let postOwnerPublicId = "";
			if (postOwner && typeof postOwner === "object" && "publicId" in postOwner) {
				postOwnerPublicId = (postOwner as any).publicId;
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
			console.error(error);
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
			throw createError(errorName, errorMessage, {
				operation: "LikeActionByPublicId",
				userId: command.userPublicId,
				postPublicId: command.postPublicId,
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
		const postId = (post as any)._id.toString();
		const added = await this.postLikeRepository.addLike(postId, userMongoId, session);
		if (!added) {
			throw createError("ConflictError", "like already exists for user and post");
		}

		await this.postWriteRepository.updateLikeCount(postId, 1, session);

		await this.userActionRepository.logAction(userMongoId, "like", (post as any)._id.toString(), session);

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
