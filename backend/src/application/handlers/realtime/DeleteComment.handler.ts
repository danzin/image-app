import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { DeleteCommentCommand } from "@/application/commands/comments/deleteComment/deleteComment.command";
import { EventBus } from "@/application/common/buses/event.bus";
import { UserInteractedWithPostEvent } from "@/application/events/user/user-interaction.event";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { CommentRepository } from "@/repositories/comment.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { createError , wrapError } from "@/utils/errors";
import { FeedInteractionHandler } from "@/application/events/user/feed-interaction.handler";
import { UnitOfWork } from "@/database/UnitOfWork";
import { logger } from "@/utils/winston";
import { IPost, PopulatedPostUser, PopulatedPostTag } from "@/types";
import mongoose from "mongoose";
import { TOKENS } from "@/types/tokens";

@injectable()
export class DeleteCommentCommandHandler implements ICommandHandler<DeleteCommentCommand, void> {
	constructor(
		@inject(TOKENS.Repositories.UnitOfWork) private readonly unitOfWork: UnitOfWork,
		@inject(TOKENS.Repositories.PostRead) private readonly postReadRepository: IPostReadRepository,
		@inject(TOKENS.Repositories.PostWrite) private readonly postWriteRepository: IPostWriteRepository,
		@inject(TOKENS.Repositories.Comment) private readonly commentRepository: CommentRepository,
		@inject(TOKENS.Repositories.UserRead) private readonly userRepository: IUserReadRepository,
		@inject(TOKENS.CQRS.Handlers.EventBus) private readonly eventBus: EventBus,
		@inject(TOKENS.CQRS.Handlers.FeedInteraction) private readonly feedInteractionHandler: FeedInteractionHandler,
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
			const { ownerInternalId: postOwnerInternalId } = this.extractPostOwnerInfo(effectivePost);
			const postOwnerMatch = postOwnerInternalId === user.id;

			if (!isCommentOwner && !postOwnerMatch) {
				throw createError("ForbiddenError", "You can only delete your own comments or comments on your posts");
			}

			// Extract post data for events
			postTags = Array.isArray(effectivePost.tags)
				? (effectivePost.tags as (mongoose.Types.ObjectId | PopulatedPostTag)[]).map(
						(t) => (typeof t === "object" && "tag" in t ? (t as PopulatedPostTag).tag : t.toString())
					)
				: [];
			const { ownerPublicId: postOwnerPublicId } = this.extractPostOwnerInfo(effectivePost);
			if (!postOwnerPublicId && postOwnerInternalId) {
				const ownerDoc = await this.userRepository.findById(postOwnerInternalId);
				postOwnerId = ownerDoc?.publicId ?? "";
			} else {
				postOwnerId = postOwnerPublicId ?? "";
			}
			postPublicId = effectivePost.publicId ?? comment.postId.toString();

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
			throw wrapError(error, "InternalServerError", {
				context: { operation: "DeleteComment", commentId: command.commentId, userPublicId: command.userPublicId },
			});
		}
	}

	private extractPostOwnerInfo(post: IPost): { ownerInternalId: string; ownerPublicId?: string } {
		const rawUser = post.user as mongoose.Types.ObjectId | PopulatedPostUser;
		const authorSnapshot = post.author;

		let ownerInternalId = "";
		if (typeof rawUser === "object" && "_id" in rawUser) {
			ownerInternalId = (rawUser as PopulatedPostUser)._id?.toString() ?? "";
		} else if (authorSnapshot?._id) {
			ownerInternalId = authorSnapshot._id.toString();
		} else if (rawUser) {
			ownerInternalId = rawUser.toString();
		}

		const ownerPublicId =
			typeof rawUser === "object" && "publicId" in rawUser
				? (rawUser as PopulatedPostUser).publicId
				: authorSnapshot?.publicId;

		return { ownerInternalId, ownerPublicId };
	}
}
