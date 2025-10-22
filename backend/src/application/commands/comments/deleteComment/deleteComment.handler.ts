import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { DeleteCommentCommand } from "./deleteComment.command";
import { EventBus } from "../../../common/buses/event.bus";
import { UserInteractedWithPostEvent } from "../../../events/user/user-interaction.event";
import { PostRepository } from "../../../../repositories/post.repository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/feed/feed-interaction.handler";
import { UnitOfWork } from "../../../../database/UnitOfWork";

@injectable()
export class DeleteCommentCommandHandler implements ICommandHandler<DeleteCommentCommand, void> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostRepository") private readonly postRepository: PostRepository,
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
		let postTags: string[] = [];
		let postOwnerId: string;
		let postPublicId: string;

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

			// Find the associated post
			const post = await this.postRepository.findById(comment.postId.toString());
			if (!post) {
				throw createError("NotFoundError", "Associated post not found");
			}
			const hydratedPost = await this.postRepository.findByPublicId((post as any).publicId);
			const effectivePost = hydratedPost ?? post;

			// Check if user owns the comment or the post
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
				const ownerDoc = await this.userRepository.findById(postOwnerInternalId);
				postOwnerId = ownerDoc?.publicId ?? "";
			} else {
				postOwnerId = postOwnerPublicId ?? "";
			}
			postPublicId = (effectivePost as any).publicId ?? comment.postId.toString();

			// Execute the comment deletion within a database transaction
			await this.unitOfWork.executeInTransaction(async (session) => {
				// Delete comment
				await this.commentRepository.deleteComment(command.commentId, session);

				// Decrement comment count on post
				await this.postRepository.updateCommentCount(comment.postId.toString(), -1, session);

				// Queue event for feed interaction handling and real-time updates
				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(command.userPublicId, "comment_deleted", postPublicId, postTags, postOwnerId),
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
