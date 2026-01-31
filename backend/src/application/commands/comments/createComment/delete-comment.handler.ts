import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { DeleteCommentCommand } from "../deleteComment/deleteComment.command";
import { EventBus } from "@/application/common/buses/event.bus";
import { UserInteractedWithPostEvent } from "@/application/events/user/user-interaction.event";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { CommentRepository } from "@/repositories/comment.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { createError } from "@/utils/errors";
import { FeedInteractionHandler } from "@/application/events/user/feed-interaction.handler";
import { UnitOfWork } from "@/database/UnitOfWork";
import { logger } from "@/utils/winston";

@injectable()
export class DeleteCommentCommandHandler implements ICommandHandler<DeleteCommentCommand, void> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler,
	) {}

	/**
	 * Handles the execution of the DeleteCommentCommand.
	 * If the comment has replies, it performs a soft delete (marks as deleted, clears user info).
	 * If the comment has no replies, it performs a hard delete (removes from database).
	 * @param command - The command containing comment ID and user ID.
	 */
	async execute(command: DeleteCommentCommand): Promise<void> {
		let postTags: string[] = [];
		let postOwnerId: string;
		let postPublicId: string;

		try {
			logger.info(
				`[DELETECOMMENTHANDLER]:\r\n  Comment ID: ${command.commentId},
				 User publicId: ${command.userPublicId} \r\n command: ${JSON.stringify(command)}`,
			);

			const user = await this.userReadRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("NotFoundError", `User with publicId ${command.userPublicId} not found`);
			}

			const comment = await this.commentRepository.findById(command.commentId);
			if (!comment) {
				throw createError("NotFoundError", "Comment not found");
			}

			// check if comment is already deleted
			if (comment.isDeleted) {
				throw createError("BadRequestError", "Comment has already been deleted");
			}

			const post = await this.postReadRepository.findById(comment.postId.toString());
			if (!post) {
				throw createError("NotFoundError", "Associated post not found");
			}
			const hydratedPost = await this.postReadRepository.findByPublicId((post as any).publicId);
			const effectivePost = hydratedPost ?? post;

			const isCommentOwner = comment.userId?.toString() === user.id;
			const postOwner = (effectivePost as any).user;
			const postOwnerInternalId =
				typeof postOwner === "object" && postOwner !== null && "_id" in postOwner
					? (postOwner as any)._id.toString()
					: (postOwner?.toString?.() ?? "");
			const postOwnerMatch = postOwnerInternalId === user.id;

			if (!isCommentOwner && !postOwnerMatch) {
				throw createError("ForbiddenError", "You can only delete your own comments or comments on your posts");
			}

			// determine if this is a user delete or admin/post owner delete
			const deletedBy: "user" | "admin" = isCommentOwner ? "user" : "admin";

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

			// check if the comment has any replies
			const hasReplies = await this.commentRepository.hasReplies(command.commentId);

			await this.unitOfWork.executeInTransaction(async (session) => {
				if (hasReplies) {
					// soft delete: keep the comment but mark as deleted and clear user association
					await this.commentRepository.softDeleteComment(command.commentId, deletedBy, session);
					logger.info(`Comment ${command.commentId} soft-deleted (has replies) by ${deletedBy}`);
				} else {
					// hard delete: no replies, safe to remove entirely
					await this.commentRepository.deleteComment(command.commentId, session);

					// decrement comment count on post only for hard deletes
					await this.postWriteRepository.updateCommentCount(comment.postId.toString(), -1, session);

					// if this comment had a parent, decrement the parent's reply count
					if (comment.parentId) {
						await this.commentRepository.updateReplyCount(comment.parentId.toString(), -1, session);
					}

					logger.info(`Comment ${command.commentId} hard-deleted (no replies) by ${deletedBy}`);
				}

				// Queue event for feed interaction handling and real-time updates
				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(command.userPublicId, "comment_deleted", postPublicId, postTags, postOwnerId),
					this.feedInteractionHandler,
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
