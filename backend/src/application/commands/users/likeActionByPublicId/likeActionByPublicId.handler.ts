import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionByPublicIdCommand } from "./likeActionByPublicId.command";
import { IImage } from "../../../../types/index";
import { EventBus } from "../../../common/buses/event.bus";
import { UserInteractedWithImageEvent } from "../../../events/user/user-interaction.event";
import { ImageRepository } from "../../../../repositories/image.repository";
import { LikeRepository } from "../../../../repositories/like.repository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { NotificationService } from "../../../../services/notification.service";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/feed/feed-interaction.handler";
import { ClientSession } from "mongoose";
import { convertToObjectId } from "../../../../utils/helpers";
import { UnitOfWork } from "../../../../database/UnitOfWork";

@injectable()
export class LikeActionByPublicIdCommandHandler implements ICommandHandler<LikeActionByPublicIdCommand, IImage> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("LikeRepository") private readonly likeRepository: LikeRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler
	) {}

	/**
	 * Handles the execution of the LikeActionByPublicIdCommand.
	 * Determines whether the action is a like or an unlike and processes it accordingly.
	 * @param command - The command containing the user ID and image public ID.
	 * @returns The updated image object.
	 * @throws Throws an error if the image is not found or if an operation fails.
	 */
	async execute(command: LikeActionByPublicIdCommand): Promise<IImage> {
		let isLikeAction = true;
		let imageTags: string[] = [];
		let existingImage: IImage | null;
		let userMongoId: string;

		try {
			// Get user's MongoDB ID from their public ID
			const user = await this.userRepository.findByPublicId(command.userId);
			if (!user) {
				throw createError("PathError", `User with public ID ${command.userId} not found`);
			}
			userMongoId = user.id;

			// Retrieve the image by public ID to ensure it exists
			existingImage = await this.imageRepository.findByPublicId(command.imagePublicId);
			if (!existingImage) {
				throw createError("PathError", `Image with public ID ${command.imagePublicId} not found`);
			}

			// Extract tags associated with the image for event tracking
			imageTags = existingImage.tags.map((t) => t.tag);

			// Execute the like/unlike operation within a database transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				const existingLike = await this.likeRepository.findByUserAndImage(userMongoId, existingImage!.id, session);

				if (existingLike) {
					// If the like already exists, perform an unlike operation
					await this.handleUnlike(command, userMongoId, existingImage!.id, session);
					isLikeAction = false;
				} else {
					// Otherwise, perform a like operation
					await this.handleLike(command, userMongoId, existingImage!, session);
				}

				// Queue an event to track user interaction with the image (using public ID for events)
				this.eventBus.queueTransactional(
					new UserInteractedWithImageEvent(
						command.userId, // Keep using public ID for events
						isLikeAction ? "like" : "unlike",
						existingImage!.id,
						imageTags
					),
					this.feedInteractionHandler
				);
			});

			// Return the updated image with the modified like count
			const updatedImage = await this.imageRepository.findByPublicId(command.imagePublicId);
			if (!updatedImage) {
				throw createError("PathError", `Image with public ID ${command.imagePublicId} not found after update`);
			}
			return updatedImage;
		} catch (error) {
			console.error(error);
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
			throw createError(errorName, errorMessage, {
				operation: "LikeActionByPublicId",
				userId: command.userId,
				imagePublicId: command.imagePublicId,
			});
		}
	}

	/**
	 * Handles the like action by creating a like record, incrementing the like count,
	 * logging the user action, and triggering a notification.
	 * @param command - The like action command containing user ID and image public ID.
	 * @param userMongoId - The user's MongoDB ID.
	 * @param image - The image being liked.
	 * @param session - The active database transaction session.
	 */
	private async handleLike(
		command: LikeActionByPublicIdCommand,
		userMongoId: string,
		image: IImage,
		session: ClientSession
	) {
		// Create a like record in the database
		await this.likeRepository.create(
			{
				userId: convertToObjectId(userMongoId),
				imageId: convertToObjectId(image.id),
			},
			session
		);

		// Increment the like count on the image
		await this.imageRepository.findOneAndUpdate({ _id: image.id }, { $inc: { likes: 1 } }, session);

		// Log the user's like action (use MongoDB ID for internal operations)
		await this.userActionRepository.logAction(userMongoId, "like", image.id, session);

		// Send a notification to the image owner about the like action (use public ID for notifications)
		await this.notificationService.createNotification({
			receiverId: image.user.publicId.toString(),
			actionType: "like",
			actorId: command.userId, // Use public ID for notifications
			targetId: image.id,
			session,
		});
	}

	/**
	 * Handles the unlike action by removing the like record, decrementing the like count,
	 * and logging the user action.
	 * @param command - The unlike action command containing user ID and image public ID.
	 * @param userMongoId - The user's MongoDB ID.
	 * @param imageId - The MongoDB ID of the image being unliked.
	 * @param session - The active database transaction session.
	 */
	private async handleUnlike(
		command: LikeActionByPublicIdCommand,
		userMongoId: string,
		imageId: string,
		session: ClientSession
	) {
		// Delete the like record from the database (use MongoDB ID)
		await this.likeRepository.deleteLike(userMongoId, imageId, session);

		// Decrement the like count on the image
		await this.imageRepository.findOneAndUpdate({ _id: imageId }, { $inc: { likes: -1 } }, session);

		// Log the user's unlike action (use MongoDB ID for internal operations)
		await this.userActionRepository.logAction(userMongoId, "unlike", imageId, session);
	}
}
