import { ClientSession } from "mongoose";
import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { UnitOfWork } from "@/database/UnitOfWork";
import { CommentRepository } from "@/repositories/comment.repository";
import { CommentLikeRepository } from "@/repositories/commentLike.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { UserActionRepository } from "@/repositories/userAction.repository";
import { EventBus } from "@/application/common/buses/event.bus";
import { NotificationRequestedEvent } from "@/application/events/notification/notification.event";
import { NotificationRequestedHandler } from "@/application/events/notification/notification-requested.handler";
import { createError } from "@/utils/errors";
import { CommentLikeResult, IComment } from "@/types";
import { LikeCommentCommand } from "./likeComment.command";

@injectable()
export class LikeCommentCommandHandler implements ICommandHandler<LikeCommentCommand, CommentLikeResult> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("CommentLikeRepository") private readonly commentLikeRepository: CommentLikeRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("NotificationRequestedHandler")
		private readonly notificationRequestedHandler: NotificationRequestedHandler,
	) {}

	async execute(command: LikeCommentCommand): Promise<CommentLikeResult> {
		let isLiked = true;
		let commentOwnerPublicId = "";
		let notifyPayload: {
			receiverId: string;
			actionType: string;
			actorId: string;
			actorUsername?: string;
			actorHandle?: string;
			actorAvatar?: string;
			targetId?: string;
			targetType?: string;
			targetPreview?: string;
		} | null = null;

		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", `User with publicId ${command.userPublicId} not found`);
		}

		const comment = await this.commentRepository.findById(command.commentId);
		if (!comment) {
			throw createError("NotFoundError", "Comment not found");
		}

		commentOwnerPublicId = await this.resolveCommentOwnerPublicId(comment);

		await this.unitOfWork.executeInTransaction(async (session: ClientSession) => {
			const userInternalId = (user as any)._id?.toString?.() || (user as any).id?.toString?.();
			if (!userInternalId) {
				throw createError("ValidationError", "User internal id missing");
			}

			const alreadyLiked = await this.commentLikeRepository.hasUserLiked(command.commentId, userInternalId, session);

			if (alreadyLiked) {
				await this.handleUnlike(command, userInternalId, session);
				isLiked = false;
				return;
			}

			await this.handleLike(command, userInternalId, comment, session);

			if (commentOwnerPublicId && commentOwnerPublicId !== command.userPublicId) {
				notifyPayload = {
					receiverId: commentOwnerPublicId,
					actionType: "comment_like",
					actorId: command.userPublicId,
					actorUsername: (user as any).username,
					actorHandle: (user as any).handle,
					actorAvatar: (user as any).avatar,
					targetId: command.commentId,
					targetType: "comment",
					targetPreview: this.buildPreview(comment),
				};
			}
			if (notifyPayload) {
				this.eventBus.queueTransactional(
					new NotificationRequestedEvent(notifyPayload),
					this.notificationRequestedHandler,
				);
			}
		});

		const updatedComment = await this.commentRepository.findById(command.commentId);
		if (!updatedComment) {
			throw createError("NotFoundError", "Comment not found after like update");
		}

		return {
			commentId: command.commentId,
			isLiked,
			likesCount: updatedComment.likesCount ?? 0,
		};
	}

	private async handleLike(
		command: LikeCommentCommand,
		userInternalId: string,
		comment: IComment,
		session: ClientSession
	): Promise<void> {
		const added = await this.commentLikeRepository.addLike(command.commentId, userInternalId, session);
		if (!added) {
			throw createError("ConflictError", "like already exists for user and comment");
		}

		await this.commentRepository.updateLikesCount(command.commentId, 1, session);
		await this.userActionRepository.logAction(userInternalId, "comment_like", command.commentId, session);
	}

	private async handleUnlike(
		command: LikeCommentCommand,
		userInternalId: string,
		session: ClientSession
	): Promise<void> {
		const removed = await this.commentLikeRepository.removeLike(command.commentId, userInternalId, session);
		if (!removed) {
			throw createError("NotFoundError", "like does not exist for user and comment");
		}

		await this.commentRepository.updateLikesCount(command.commentId, -1, session);
		await this.userActionRepository.logAction(userInternalId, "comment_unlike", command.commentId, session);
	}

	private async resolveCommentOwnerPublicId(comment: IComment): Promise<string> {
		const ownerId = (comment as any).userId?.toString?.();
		if (!ownerId) return "";

		const owner = await this.userReadRepository.findById(ownerId);
		return owner?.publicId ?? "";
	}

	private buildPreview(comment: IComment): string {
		const raw = (comment as any).content ?? "";
		if (typeof raw !== "string") return "";
		if (raw.length <= 50) return raw;
		return `${raw.slice(0, 50)}...`;
	}
}
