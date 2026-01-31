import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { CreateCommentCommand } from "./createComment.command";
import { EventBus } from "@/application/common/buses/event.bus";
import { UserInteractedWithPostEvent } from "@/application/events/user/user-interaction.event";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { CommentRepository } from "@/repositories/comment.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { NotificationService } from "@/services/notification.service";
import { createError } from "@/utils/errors";
import { FeedInteractionHandler } from "@/application/events/user/feed-interaction.handler";
import { UnitOfWork } from "@/database/UnitOfWork";
import sanitizeHtml from "sanitize-html";
import { sanitizeForMongo, isValidPublicId } from "@/utils/sanitizers";
import { IComment, TransformedComment } from "@/types";
import mongoose from "mongoose";
import { logger } from "@/utils/winston";

@injectable()
export class CreateCommentCommandHandler implements ICommandHandler<CreateCommentCommand, TransformedComment> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler,
	) {}

	/**
	 * Handles the execution of the CreateCommentCommand.
	 * Creates a comment, updates counts, sends notifications, and publishes events.
	 * @param command - The command containing user ID, image publicId, and content.
	 * @returns The created comment object.
	 */
	async execute(command: CreateCommentCommand): Promise<TransformedComment> {
		// Validate input straight away
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
		let parentComment: IComment | null = null;
		let depth = 0;

		try {
			logger.info(`[CREATECOMMENTHANDLER] user=${command.userPublicId} post=${command.postPublicId}`);

			const user = await this.userReadRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("NotFoundError", `User with publicId ${command.userPublicId} not found`);
			}

			const post = await this.postReadRepository.findByPublicId(command.postPublicId);
			if (!post) {
				throw createError("NotFoundError", `Post with publicId ${command.postPublicId} not found`);
			}

			if (command.parentId) {
				parentComment = await this.commentRepository.findById(command.parentId);
				if (!parentComment) {
					throw createError("NotFoundError", "Parent comment not found");
				}

				if (parentComment.postId.toString() !== (post._id as mongoose.Types.ObjectId).toString()) {
					throw createError("ValidationError", "Parent comment does not belong to the same post");
				}

				const parentDepth = (parentComment as any).depth ?? 0;
				depth = parentDepth + 1;
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
					userId: user._id as mongoose.Types.ObjectId,
					parentId: command.parentId ? new mongoose.Types.ObjectId(command.parentId) : null,
					replyCount: 0,
					depth,
				};

				const safePayload = sanitizeForMongo(payload);

				createdComment = await this.commentRepository.create(safePayload as Partial<IComment>, session);

				// Increment comment count on post
				await this.postWriteRepository.updateCommentCount((post._id as mongoose.Types.ObjectId).toString(), 1, session);

				if (command.parentId) {
					await this.commentRepository.updateReplyCount(command.parentId, 1, session);
				}

				// Send notification to post owner (if not commenting on own post)
				if (postOwnerId && postOwnerId !== command.userPublicId) {
					const postPreview = post.body
						? post.body.substring(0, 50) + (post.body.length > 50 ? "..." : "")
						: post.image
							? "[Image post]"
							: "[Post]";

					await this.notificationService.createNotification({
						receiverId: postOwnerId,
						actionType: "comment",
						actorId: command.userPublicId,
						actorUsername: user.username,
						actorAvatar: user.avatar,
						targetId: command.postPublicId,
						targetType: "post",
						targetPreview: postPreview,
						session,
					});
				}

				// Send notification to parent comment owner (for replies), but avoid double notifying post owner
				if (command.parentId && parentComment) {
					const parentOwnerId = (parentComment as any).userId?.toString?.();
					if (parentOwnerId) {
						const parentOwner = await this.userReadRepository.findById(parentOwnerId);
						const parentOwnerPublicId = parentOwner?.publicId;
						if (
							parentOwnerPublicId &&
							parentOwnerPublicId !== command.userPublicId &&
							parentOwnerPublicId !== postOwnerId
						) {
							await this.notificationService.createNotification({
								receiverId: parentOwnerPublicId,
								actionType: "comment_reply",
								actorId: command.userPublicId,
								actorUsername: user.username,
								actorAvatar: user.avatar,
								targetId: command.postPublicId,
								targetType: "comment",
								targetPreview: safeContent.substring(0, 50) + (safeContent.length > 50 ? "..." : ""),
								session,
							});
						}
					}
				}

				// Handle mentions
				const mentionRegex = /@(\w+)/g;
				logger.info(`[CreateComment] Content for mention parsing: "${safeContent}"`);
				const mentions = [...safeContent.matchAll(mentionRegex)].map((match) => match[1]);
				logger.info(`[CreateComment] Raw mentions found: ${JSON.stringify(mentions)}`);

				if (mentions.length > 0) {
					const uniqueMentions = [...new Set(mentions)];
					logger.info(`[CreateComment] Looking up users for: ${uniqueMentions.join(", ")}`);
					const mentionedUsers = await this.userReadRepository.findUsersByUsernames(uniqueMentions);
					logger.info(`[CreateComment] Found ${mentionedUsers.length} users`);

					for (const mentionedUser of mentionedUsers) {
						logger.info(`[CreateComment] Checking user ${mentionedUser.username} (${mentionedUser.publicId})`);

						// Filter: Remove comment author
						if (mentionedUser.publicId === command.userPublicId) {
							logger.info(`[CreateComment] Skipping self-mention`);
							continue;
						}

						// Filter: Remove post owner since I already notified them above
						if (mentionedUser.publicId === postOwnerId) {
							logger.info(`[CreateComment] Skipping post owner (already notified)`);
							continue;
						}

						logger.info(`[CreateComment] Creating mention notification for ${mentionedUser.publicId}`);
						await this.notificationService.createNotification({
							receiverId: mentionedUser.publicId,
							actionType: "mention",
							actorId: command.userPublicId,
							actorUsername: user.username,
							actorAvatar: user.avatar,
							targetId: command.postPublicId,
							targetType: "post",
							targetPreview: safeContent.substring(0, 50) + (safeContent.length > 50 ? "..." : ""),
							session,
						});
					}
				}

				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(command.userPublicId, "comment", sanitizedPostId, postTags, postOwnerId),
					this.feedInteractionHandler,
				);
			});

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
