import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { DeleteCommentCommand } from "@/application/commands/comments/deleteComment/deleteComment.command";
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
		@inject("UserReadRepository") private readonly userRepository: IUserReadRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler,
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
				 User publicId: ${command.userPublicId} \r\n command: ${JSON.stringify(command)}`,
			);

			const user = await this.userRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("NotFoundError", `User with publicId ${command.userPublicId} not found`);
			}

			const comment = await this.commentRepository.findById(command.commentId);
			if (!comment) {
				throw createError("NotFoundError", "Comment not found");
			}

			const effectivePost = (await this.postReadRepository.findByIdWithPopulates(comment.postId.toString())) ?? null;
			if (!effectivePost) throw createError("NotFoundError", "Associated post not found");

			// Check if user owns the comment or the post
			const isCommentOwner = comment.userId && comment.userId.toString() === user.id;
			const { ownerInternalId: postOwnerInternalId } = this.extractPostOwnerInfo(effectivePost as any);
			const postOwnerMatch = postOwnerInternalId === user.id;

			if (!isCommentOwner && !postOwnerMatch) {
				throw createError("ForbiddenError", "You can only delete your own comments or comments on your posts");
			}

			// Extract post data for events
			postTags = Array.isArray((effectivePost as any).tags)
				? (effectivePost as any).tags.map((t: any) => t.tag ?? t)
				: [];
			const { ownerPublicId: postOwnerPublicId } = this.extractPostOwnerInfo(effectivePost as any);
			if (!postOwnerPublicId && postOwnerInternalId) {
				const ownerDoc = await this.userRepository.findById(postOwnerInternalId);
				postOwnerId = ownerDoc?.publicId ?? "";
			} else {
				postOwnerId = postOwnerPublicId ?? "";
			}
			postPublicId = (effectivePost as any).publicId ?? comment.postId.toString();

			// Execute the comment deletion within transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				// Delete comment
				await this.commentRepository.deleteComment(command.commentId, session);

				// Decrement comment count on post
				await this.postWriteRepository.updateCommentCount(comment.postId.toString(), -1, session);

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

	private extractPostOwnerInfo(post: any): { ownerInternalId: string; ownerPublicId?: string } {
		const rawUser = post?.user;
		const authorSnapshot = post?.author;

		let ownerInternalId = "";
		if (rawUser && typeof rawUser === "object" && "_id" in rawUser) {
			ownerInternalId = rawUser._id?.toString?.() ?? "";
		} else if (authorSnapshot?._id) {
			ownerInternalId = authorSnapshot._id.toString();
		} else if (typeof rawUser?.toString === "function") {
			ownerInternalId = rawUser.toString();
		}

		const ownerPublicId =
			typeof rawUser === "object" && rawUser !== null && "publicId" in rawUser
				? (rawUser as any).publicId
				: authorSnapshot?.publicId;

		return { ownerInternalId, ownerPublicId };
	}
}
