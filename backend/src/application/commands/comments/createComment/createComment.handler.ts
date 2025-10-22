import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { CreateCommentCommand } from "./createComment.command";
import { TransformedComment } from "../../../../repositories/comment.repository";
import { EventBus } from "../../../common/buses/event.bus";
import { UserInteractedWithPostEvent } from "../../../events/user/user-interaction.event";
import { PostRepository } from "../../../../repositories/post.repository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { NotificationService } from "../../../../services/notification.service";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/feed/feed-interaction.handler";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import sanitizeHtml from "sanitize-html";
import { sanitizeForMongo, isValidPublicId } from "../../../../utils/sanitizers";
import { IComment } from "types/index";
import mongoose from "mongoose";

@injectable()
export class CreateCommentCommandHandler implements ICommandHandler<CreateCommentCommand, TransformedComment> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostRepository") private readonly postRepository: PostRepository,
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
		if (typeof command.content !== "string") {
			throw createError("ValidationError", "Comment content must be a string");
		}

		if (!isValidPublicId(command.postPublicId)) {
			throw createError("ValidationError", "Invalid postPublicId format");
		}

		const trimmed = command.content.trim();
		if (!trimmed) {
			throw createError("ValidationError", "Comment content cannot be empty");
		}

		const safeContent = sanitizeHtml(trimmed, { allowedTags: [], allowedAttributes: {} });

		if (!safeContent || safeContent.length === 0) {
			throw createError("ValidationError", "Comment content empty after sanitization");
		}

		if (safeContent.length > 280) {
			throw createError("ValidationError", "Comment cannot exceed 280 characters");
		}

		let createdComment: any;
		let postTags: string[] = [];
		let postOwnerId: string;

		try {
			console.log(`[CREATECOMMENTHANDLER] user=${command.userPublicId} post=${command.postPublicId}`);

			// Find user by public ID
			const user = await this.userRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("NotFoundError", `User with public ID ${command.userPublicId} not found`);
			}

			// Find post by public ID
			const post = await this.postRepository.findByPublicId(command.postPublicId);
			if (!post) {
				throw createError("NotFoundError", `Post with public ID ${command.postPublicId} not found`);
			}

			postTags = Array.isArray(post.tags) ? post.tags.map((t: any) => t.tag ?? t) : [];
			const postOwner = (post as any).user;
			postOwnerId =
				typeof postOwner === "object" && postOwner !== null && "publicId" in postOwner
					? (postOwner as any).publicId
					: (postOwner?.toString?.() ?? "");
			const sanitizedPostId = post.publicId;

			await this.unitOfWork.executeInTransaction(async (session) => {
				const payload: Partial<IComment> = {
					content: safeContent,
					postId: post._id as mongoose.Types.ObjectId,
					userId: new mongoose.Types.ObjectId(user.id),
				};

				const safePayload = sanitizeForMongo(payload);

				createdComment = await this.commentRepository.create(safePayload as Partial<IComment>, session);

				// Increment comment count on post
				await this.postRepository.updateCommentCount((post._id as mongoose.Types.ObjectId).toString(), 1, session);

				// Send notification to post owner (if not commenting on own post)
				if (postOwnerId && postOwnerId !== command.userPublicId) {
					await this.notificationService.createNotification({
						receiverId: postOwnerId,
						actionType: "comment",
						actorId: command.userPublicId,
						actorUsername: user.username,
						targetId: command.postPublicId,
						session,
					});
				}

				// Queue event for feed interaction handling and real-time updates
				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(command.userPublicId, "comment", sanitizedPostId, postTags, postOwnerId),
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
				postPublicId: command.postPublicId,
			});
		}
	}
}
