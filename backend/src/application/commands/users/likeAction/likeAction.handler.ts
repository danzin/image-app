import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionCommand } from "./likeAction.command";
import { IPost } from "@/types/index";
import { EventBus } from "@/application/common/buses/event.bus";
import { UserInteractedWithPostEvent } from "@/application/events/user/user-interaction.event";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { PostLikeRepository } from "@/repositories/postLike.repository";
import { UserActionRepository } from "@/repositories/userAction.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { NotificationRequestedEvent } from "@/application/events/notification/notification.event";
import { NotificationRequestedHandler } from "@/application/events/notification/notification-requested.handler";
import { createError } from "@/utils/errors";
import { FeedInteractionHandler } from "@/application/events/user/feed-interaction.handler";
import { FeedService } from "@/services/feed.service";
import { ClientSession } from "mongoose";
import { UnitOfWork } from "@/database/UnitOfWork";
import { logger } from "@/utils/winston";
@injectable()
export class LikeActionCommandHandler implements ICommandHandler<LikeActionCommand, IPost> {
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
		@inject("FeedService") private readonly feedService: FeedService
	) {}

	// TODO: REFACTOR AND REMOVE OLD METHODS

	/**
	 * Handles the execution of the LikeActionCommand.
	 * Determines whether the action is a like or an unlike and processes it accordingly.
	 * @param command - The command containing the user ID and image ID.
	 * @returns The updated image object.
	 * @throws Throws an error if the image is not found or if an operation fails.
	 */
	async execute(command: LikeActionCommand): Promise<IPost> {
		let isLikeAction = true;
		let postTags: string[] = [];
		let existingPost: IPost | null;

		try {
			existingPost = await this.postReadRepository.findById(command.postId);
			if (!existingPost) {
				throw createError("PathError", `Post ${command.postId} not found`);
			}
			postTags = Array.isArray((existingPost as any).tags)
				? (existingPost as any).tags.map((t: any) => t.tag ?? t)
				: [];

			// Execute the like/unlike operation within transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				const existingLike = await this.postLikeRepository.hasUserLiked(command.postId, command.userId, session);

				if (existingLike) {
					// If the like already exists, perform an unlike operation
					await this.handleUnlike(command, session);
					isLikeAction = false;
				} else {
					// perform a like operation
					await this.handleLike(command, existingPost!, session);
				}

				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(
						command.userId,
						isLikeAction ? "like" : "unlike",
						(existingPost as any).publicId ?? command.postId,
						postTags,
						(existingPost as any).user?.publicId ?? (existingPost as any).user?.toString?.() ?? ""
					),
					this.feedInteractionHandler
				);
			});

			// Return the updated image with the modified like count
			const updatedPost = await this.postReadRepository.findById(command.postId);
			if (!updatedPost) {
				throw createError("PathError", `Post ${command.postId} not found after update`);
			}
			// Update per-post meta cache asynchronously as not to block respons
			if ((updatedPost as any).publicId) {
				this.feedService
					.updatePostLikeMeta((updatedPost as any).publicId, (updatedPost as any).likesCount ?? 0)
					.catch((e) => console.warn("updatePostLikeMeta failed", e));
			}
			return updatedPost;
		} catch (error) {
			console.error(error);
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
			throw createError(errorName, errorMessage, {
				operation: "LikeAction",
				userId: command.userId,
				postId: command.postId,
			});
		}
	}

	/**
	 * Handles the like action by creating a like record, incrementing the like count,
	 * logging the user action, and triggering a notification.
	 * @param command - The like action command containing user ID and post ID.
	 * @param post - The post being liked.
	 * @param session - The active database transaction session.
	 */
	private async handleLike(command: LikeActionCommand, post: IPost, session: ClientSession) {
		const added = await this.postLikeRepository.addLike(command.postId, command.userId, session);
		if (!added) {
			throw createError("ConflictError", "like already exists for user and post");
		}

		await this.postWriteRepository.updateLikeCount(command.postId, 1, session);

		await this.userActionRepository.logAction(command.userId, "like", command.postId, session);

		const postOwner = (post as any).user;
		const postAuthor = (post as any).author;
		let postOwnerPublicId = "";

		logger.info(`[LikeAction] Resolving post owner for post ${command.postId}. postOwner raw:`, postOwner);
		if (postAuthor) {
			logger.info(`[LikeAction] post.author found:`, postAuthor);
		}

		// author.publicId if available since its embedded
		if (postAuthor && postAuthor.publicId) {
			postOwnerPublicId = postAuthor.publicId;
			logger.info(`[LikeAction] Resolved owner from post.author.publicId: ${postOwnerPublicId}`);
		} else if (postOwner && typeof postOwner === "object" && "publicId" in postOwner) {
			postOwnerPublicId = (postOwner as any).publicId.toString();
			logger.info(`[LikeAction] Resolved owner from populated object: ${postOwnerPublicId}`);
		} else if (postOwner) {
			// Resolve user publicId from ObjectId
			const ownerUser = await this.userReadRepository.findById(postOwner.toString());
			if (ownerUser) {
				postOwnerPublicId = ownerUser.publicId;
				logger.info(`[LikeAction] Resolved owner from DB lookup: ${postOwnerPublicId}`);
			} else {
				console.warn(`[LikeAction] Could not find user for ObjectId: ${postOwner}`);
			}
		}

		if (postOwnerPublicId && postOwnerPublicId !== command.userId) {
			logger.info(`[LikeAction] Queuing notification for owner ${postOwnerPublicId} from actor ${command.userId}`);
			const actorUser = await this.userReadRepository.findById(command.userId);
			this.eventBus.queueTransactional(
				new NotificationRequestedEvent({
					receiverId: postOwnerPublicId,
					actionType: "like",
					actorId: command.userId,
					actorUsername: actorUser?.username,
					actorHandle: actorUser?.handle,
					actorAvatar: actorUser?.avatar,
					targetId: (post as any).publicId ?? command.postId,
				}),
				this.notificationRequestedHandler,
			);
		} else {
			logger.info(
				`[LikeAction] Skipping notification. Owner: ${postOwnerPublicId}, Actor: ${command.userId}, Same? ${postOwnerPublicId === command.userId}`
			);
		}
	}

	/**
	 * Handles the unlike action by removing the like record, decrementing the like count,
	 * and logging the user action.
	 * @param command - The unlike action command containing user ID and post ID.
	 * @param session - The active database transaction session.
	 */
	private async handleUnlike(command: LikeActionCommand, session: ClientSession) {
		const removed = await this.postLikeRepository.removeLike(command.postId, command.userId, session);
		if (!removed) {
			throw createError("NotFoundError", "like does not exist for user and post");
		}

		await this.postWriteRepository.updateLikeCount(command.postId, -1, session);

		await this.userActionRepository.logAction(command.userId, "unlike", command.postId, session);
	}
}
