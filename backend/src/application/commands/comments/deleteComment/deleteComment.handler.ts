import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { DeleteCommentCommand } from "./deleteComment.command";
import { EventBus } from "../../../common/buses/event.bus";
import { UserInteractedWithImageEvent } from "../../../events/user/user-interaction.event";
import { ImageRepository } from "../../../../repositories/image.repository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/feed/feed-interaction.handler";
import { UnitOfWork } from "../../../../database/UnitOfWork";

@injectable()
export class DeleteCommentCommandHandler implements ICommandHandler<DeleteCommentCommand, void> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler
	) {}

	/**
	 * Handles the execution of the DeleteCommentCommand.
	 * Deletes a comment, updates counts, and publishes events.
	 * @param command - The command containing comment ID and user ID.
	 */
	async execute(command: DeleteCommentCommand): Promise<void> {
		let imageTags: string[] = [];
		let imageOwnerId: string;
		let imagePublicId: string;

		try {
			console.log(
				`[DELETECOMMENTHANDLER]:\r\n  Comment ID: ${command.commentId},
				 User public ID: ${command.userPublicId} \r\n command: ${JSON.stringify(command)}`
			);

			// Find user by public ID
			const user = await this.userRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("NotFoundError", `User with public ID ${command.userPublicId} not found`);
			}

			// Find comment to validate ownership and get image info
			const comment = await this.commentRepository.findById(command.commentId);
			if (!comment) {
				throw createError("NotFoundError", "Comment not found");
			}

			// Find the associated image
			const image = await this.imageRepository.findById(comment.imageId.toString());
			if (!image) {
				throw createError("NotFoundError", "Associated image not found");
			}

			// Check if user owns the comment or the image
			const isCommentOwner = comment.userId.toString() === user.id;
			const isImageOwner = image.user.toString() === user.id;

			if (!isCommentOwner && !isImageOwner) {
				throw createError("ForbiddenError", "You can only delete your own comments or comments on your images");
			}

			// Extract image data for events
			imageTags = image.tags.map((t) => t.tag);
			imageOwnerId = image.user.publicId;
			imagePublicId = image.publicId;

			// Execute the comment deletion within a database transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				// Delete comment
				await this.commentRepository.deleteComment(command.commentId, session);

				// Decrement comment count on image
				await this.imageRepository.updateCommentCount(comment.imageId.toString(), -1, session);

				// Queue event for feed interaction handling and real-time updates
				this.eventBus.queueTransactional(
					new UserInteractedWithImageEvent(
						command.userPublicId,
						"comment_deleted",
						imagePublicId,
						imageTags,
						imageOwnerId
					),
					this.feedInteractionHandler
				);
			});

			console.log(`Comment ${command.commentId} successfully deleted by user ${command.userPublicId}`);
		} catch (error) {
			console.error("DeleteCommentCommand execution failed:", error);
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
			throw createError(errorName, errorMessage, {
				operation: "DeleteComment",
				commentId: command.commentId,
				userPublicId: command.userPublicId,
			});
		}
	}
}
