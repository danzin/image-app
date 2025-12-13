import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { DeleteCommentCommand } from "../deleteComment/deleteComment.command";
import { EventBus } from "../../../common/buses/event.bus";
import { UserInteractedWithPostEvent } from "../../../events/user/user-interaction.event";
import { IPostReadRepository } from "../../../../repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "../../../../repositories/interfaces/IPostWriteRepository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/user/feed-interaction.handler";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { logger } from "../../../../utils/winston";

@injectable()
export class DeleteCommentCommandHandler implements ICommandHandler<DeleteCommentCommand, void> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler
	) {}

	/**
	 * Handles the execution of the DeleteCommentCommand.
	 * Deletes a comment, updates counts, and publishes events.
	 * @param command - The command containing comment ID and user ID.
	 */
	async execute(command: DeleteCommentCommand): Promise<void> {
		let postTags: string[] = [];
		let postOwnerId: string;
		let postPublicId: string;

		try {
			logger.info(
				`[DELETECOMMENTHANDLER]:\r\n  Comment ID: ${command.commentId},
				 User publicId: ${command.userPublicId} \r\n command: ${JSON.stringify(command)}`
			);

			const user = await this.userReadRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("NotFoundError", `User with publicId ${command.userPublicId} not found`);
			}

			const comment = await this.commentRepository.findById(command.commentId);
			if (!comment) {
				throw createError("NotFoundError", "Comment not found");
			}

			const post = await this.postReadRepository.findById(comment.postId.toString());
			if (!post) {
				throw createError("NotFoundError", "Associated post not found");
			}
			const hydratedPost = await this.postReadRepository.findByPublicId((post as any).publicId);
			const effectivePost = hydratedPost ?? post;

			const isCommentOwner = comment.userId.toString() === user.id;
			const postOwner = (effectivePost as any).user;
			const postOwnerInternalId =
				typeof postOwner === "object" && postOwner !== null && "_id" in postOwner
					? (postOwner as any)._id.toString()
					: (postOwner?.toString?.() ?? "");
			const postOwnerMatch = postOwnerInternalId === user.id;

			if (!isCommentOwner && !postOwnerMatch) {
				throw createError("ForbiddenError", "You can only delete your own comments or comments on your posts");
			}

			// Extract post data for events
			postTags = Array.isArray((effectivePost as any).tags)
				? (effectivePost as any).tags.map((t: any) => t.tag ?? t)
				: [];
			const postOwnerPublicId =
				typeof postOwner === "object" && postOwner !== null && "publicId" in postOwner
					? (postOwner as any).publicId
					: undefined;
			if (!postOwnerPublicId && postOwnerInternalId) {
				const ownerDoc = await this.userReadRepository.findById(postOwnerInternalId);
				postOwnerId = ownerDoc?.publicId ?? "";
			} else {
				postOwnerId = postOwnerPublicId ?? "";
			}
			postPublicId = (effectivePost as any).publicId ?? comment.postId.toString();

			await this.unitOfWork.executeInTransaction(async (session) => {
				await this.commentRepository.deleteComment(command.commentId, session);

				await this.postWriteRepository.updateCommentCount(comment.postId.toString(), -1, session);

				// Queue event for feed interaction handling and real-time updates
				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(command.userPublicId, "comment_deleted", postPublicId, postTags, postOwnerId),
					this.feedInteractionHandler
				);
			});

			logger.info(`Comment ${command.commentId} successfully deleted by user ${command.userPublicId}`);
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
