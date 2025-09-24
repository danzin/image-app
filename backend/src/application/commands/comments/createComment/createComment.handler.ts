import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { CreateCommentCommand } from "./createComment.command";
import { TransformedComment } from "../../../../repositories/comment.repository";
import { EventBus } from "../../../common/buses/event.bus";
import { UserInteractedWithImageEvent } from "../../../events/user/user-interaction.event";
import { ImageRepository } from "../../../../repositories/image.repository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { NotificationService } from "../../../../services/notification.service";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/feed/feed-interaction.handler";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { IComment } from "../../../../models/comment.model";
import mongoose from "mongoose";

@injectable()
export class CreateCommentCommandHandler implements ICommandHandler<CreateCommentCommand, TransformedComment> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler
	) {}

	/**
	 * Handles the execution of the CreateCommentCommand.
	 * Creates a comment, updates counts, sends notifications, and publishes events.
	 * @param command - The command containing user ID, image public ID, and content.
	 * @returns The created comment object.
	 */
	async execute(command: CreateCommentCommand): Promise<TransformedComment> {
		// Validate input
		if (!command.content.trim()) {
			throw createError("ValidationError", "Comment content cannot be empty");
		}

		if (command.content.length > 500) {
			throw createError("ValidationError", "Comment cannot exceed 500 characters");
		}

		let createdComment: any;
		let imageTags: string[] = [];
		let imageOwnerId: string;

		try {
			console.log(
				`[CREATECOMMENTHANDLER]:\r\n  User public ID: ${command.userPublicId},
				 Image public ID: ${command.imagePublicId} \r\n command: ${JSON.stringify(command)}`
			);

			// Find user by public ID
			const user = await this.userRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("NotFoundError", `User with public ID ${command.userPublicId} not found`);
			}

			// Find image by public ID
			const image = await this.imageRepository.findByPublicId(command.imagePublicId);
			if (!image) {
				throw createError("NotFoundError", `Image with public ID ${command.imagePublicId} not found`);
			}

			// Extract image data for events
			imageTags = image.tags.map((t) => t.tag);
			imageOwnerId = image.user.publicId;
			const sanitizedImageId = image.publicId; // Use the clean image public ID from database

			// Execute the comment creation within a database transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				// Create comment
				createdComment = await this.commentRepository.create(
					{
						content: command.content.trim(),
						imageId: image._id as mongoose.Types.ObjectId,
						userId: new mongoose.Types.ObjectId(user.id),
					} as Partial<IComment>,
					session
				);

				// Increment comment count on image
				await this.imageRepository.updateCommentCount(image.id, 1, session);

				// Send notification to image owner (if not commenting on own image)
				if (imageOwnerId !== command.userPublicId) {
					await this.notificationService.createNotification({
						receiverId: imageOwnerId,
						actionType: "comment",
						actorId: command.userPublicId,
						actorUsername: user.username,
						targetId: command.imagePublicId,
						session,
					});
				}

				// Queue event for feed interaction handling and real-time updates
				this.eventBus.queueTransactional(
					new UserInteractedWithImageEvent(
						command.userPublicId,
						"comment",
						sanitizedImageId, // Use sanitized image ID without extension
						imageTags,
						imageOwnerId
					),
					this.feedInteractionHandler
				);
			});

			// Return the populated comment
			const populatedComment = await this.commentRepository.findByIdTransformed(createdComment._id.toString());
			if (!populatedComment) {
				throw createError("InternalError", "Failed to retrieve created comment");
			}

			return populatedComment;
		} catch (error) {
			console.error("CreateCommentCommand execution failed:", error);
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
			throw createError(errorName, errorMessage, {
				operation: "CreateComment",
				userPublicId: command.userPublicId,
				imagePublicId: command.imagePublicId,
			});
		}
	}
}
