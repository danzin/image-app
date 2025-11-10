import { ICommandHandler } from "../../../../application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionCommand } from "./likeAction.command";
import { IPost } from "../../../../types/index";
import { EventBus } from "../../../../application/common/buses/event.bus";
import { UserInteractedWithPostEvent } from "../../../../application/events/user/user-interaction.event";
import { PostRepository } from "../../../../repositories/post.repository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { NotificationService } from "../../../../services/notification.service";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/user/feed-interaction.handler";
import { FeedService } from "../../../../services/feed.service";
import { ClientSession } from "mongoose";
import { UnitOfWork } from "../../../../database/UnitOfWork";

@injectable()
export class LikeActionCommandHandler implements ICommandHandler<LikeActionCommand, IPost> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("EventBus") private readonly eventBus: EventBus,
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
			// Retrieve the post by ID to ensure it exists
			existingPost = await this.postRepository.findById(command.postId);
			if (!existingPost) {
				throw createError("PathError", `Post ${command.postId} not found`);
			}
			// Extract tags associated with the post for event tracking
			postTags = Array.isArray((existingPost as any).tags)
				? (existingPost as any).tags.map((t: any) => t.tag ?? t)
				: [];

			// Execute the like/unlike operation within a database transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				const existingLike = await this.postRepository.hasUserLiked(command.postId, command.userId, session);

				if (existingLike) {
					// If the like already exists, perform an unlike operation
					await this.handleUnlike(command, session);
					isLikeAction = false;
				} else {
					// Otherwise, perform a like operation
					await this.handleLike(command, existingPost!, session);
				}

				// Queue an event to track user interaction with the image
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
			const updatedPost = await this.postRepository.findById(command.postId);
			if (!updatedPost) {
				throw createError("PathError", `Post ${command.postId} not found after update`);
			}
			// Update per-post meta cache asynchronously (do not block response)
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
		const added = await this.postRepository.addLike(command.postId, command.userId, session);
		if (!added) {
			throw createError("ConflictError", "like already exists for user and post");
		}

		// Log the user's like action
		await this.userActionRepository.logAction(command.userId, "like", command.postId, session);

		// Send a notification to the post owner about the like action
		const postOwner = (post as any).user;
		const postOwnerPublicId =
			typeof postOwner === "object" && postOwner !== null && "publicId" in postOwner
				? (postOwner as any).publicId.toString()
				: postOwner?.toString?.();

		if (postOwnerPublicId && postOwnerPublicId !== command.userId) {
			await this.notificationService.createNotification({
				receiverId: postOwnerPublicId,
				actionType: "like",
				actorId: command.userId,
				targetId: (post as any).publicId ?? command.postId,
				session,
			});
		}
	}

	/**
	 * Handles the unlike action by removing the like record, decrementing the like count,
	 * and logging the user action.
	 * @param command - The unlike action command containing user ID and post ID.
	 * @param session - The active database transaction session.
	 */
	private async handleUnlike(command: LikeActionCommand, session: ClientSession) {
		const removed = await this.postRepository.removeLike(command.postId, command.userId, session);
		if (!removed) {
			throw createError("NotFoundError", "like does not exist for user and post");
		}

		// Log the user's unlike action
		await this.userActionRepository.logAction(command.userId, "unlike", command.postId, session);
	}
}
