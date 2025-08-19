import { ICommandHandler } from "../../../../application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionCommand } from "./likeAction.command";
import { IImage } from "../../../../types/index";
import { EventBus } from "../../../../application/common/buses/event.bus";
import { UserInteractedWithImageEvent } from "../../../../application/events/user/user-interaction.event";
import { ImageRepository } from "../../../../repositories/image.repository";
import { LikeRepository } from "../../../../repositories/like.repository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { NotificationService } from "../../../../services/notification.service";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/feed/feed-interaction.handler";
import { ClientSession } from "mongoose";
import { convertToObjectId } from "../../../../utils/helpers";
import { UnitOfWork } from "../../../../database/UnitOfWork";

@injectable()
export class LikeActionCommandHandler implements ICommandHandler<LikeActionCommand, IImage> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("LikeRepository") private readonly likeRepository: LikeRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler
	) {}

	// TODO: REFACTOR AND REMOVE OLD METHODS

	/**
	 * Handles the execution of the LikeActionCommand.
	 * Determines whether the action is a like or an unlike and processes it accordingly.
	 * @param command - The command containing the user ID and image ID.
	 * @returns The updated image object.
	 * @throws Throws an error if the image is not found or if an operation fails.
	 */
	async execute(command: LikeActionCommand): Promise<IImage> {
		let isLikeAction = true;
		let imageTags: string[] = [];
		let existingImage: IImage | null;

		try {
			// Retrieve the image by ID to ensure it exists
			existingImage = await this.imageRepository.findById(command.imageId);
			if (!existingImage) {
				throw createError("PathError", `Image ${command.imageId} not found`);
			}
			// Extract tags associated with the image for event tracking
			imageTags = existingImage.tags.map((t) => t.tag);

			// Execute the like/unlike operation within a database transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				const existingLike = await this.likeRepository.findByUserAndImage(command.userId, command.imageId, session);

				if (existingLike) {
					// If the like already exists, perform an unlike operation
					await this.handleUnlike(command, session);
					isLikeAction = false;
				} else {
					// Otherwise, perform a like operation
					await this.handleLike(command, existingImage!, session);
				}

				// Queue an event to track user interaction with the image
				this.eventBus.queueTransactional(
					new UserInteractedWithImageEvent(
						command.userId,
						isLikeAction ? "like" : "unlike",
						command.imageId,
						imageTags,
						existingImage!.user.publicId
					),
					this.feedInteractionHandler
				);
			});

			// Return the updated image with the modified like count
			const updatedImage = await this.imageRepository.findById(command.imageId);
			if (!updatedImage) {
				throw createError("PathError", `Image ${command.imageId} not found after update`);
			}
			return updatedImage;
		} catch (error) {
			console.error(error);
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
			throw createError(errorName, errorMessage, {
				operation: "LikeAction",
				userId: command.userId,
				imageId: command.imageId,
			});
		}
	}

	/**
	 * Handles the like action by creating a like record, incrementing the like count,
	 * logging the user action, and triggering a notification.
	 * @param command - The like action command containing user ID and image ID.
	 * @param image - The image being liked.
	 * @param session - The active database transaction session.
	 */
	private async handleLike(command: LikeActionCommand, image: IImage, session: ClientSession) {
		// Create a like record in the database
		await this.likeRepository.create(
			{
				userId: convertToObjectId(command.userId),
				imageId: convertToObjectId(command.imageId),
			},
			session
		);

		// Increment the like count on the image
		await this.imageRepository.findOneAndUpdate({ _id: command.imageId }, { $inc: { likes: 1 } }, session);

		// Log the user's like action
		await this.userActionRepository.logAction(command.userId, "like", command.imageId, session);

		// Send a notification to the image owner about the like action
		await this.notificationService.createNotification({
			receiverId: image.user.publicId.toString(),
			actionType: "like",
			actorId: command.userId,
			targetId: command.imageId,
			session,
		});
	}

	/**
	 * Handles the unlike action by removing the like record, decrementing the like count,
	 * and logging the user action.
	 * @param command - The unlike action command containing user ID and image ID.
	 * @param session - The active database transaction session.
	 */
	private async handleUnlike(command: LikeActionCommand, session: ClientSession) {
		// Delete the like record from the database
		await this.likeRepository.deleteLike(command.userId, command.imageId, session);

		// Decrement the like count on the image
		await this.imageRepository.findOneAndUpdate({ _id: command.imageId }, { $inc: { likes: -1 } }, session);

		// Log the user's unlike action
		await this.userActionRepository.logAction(command.userId, "unlike", command.imageId, session);
	}
}
