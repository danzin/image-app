import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { UnrepostPostCommand } from "./unrepostPost.command";
import { IPostReadRepository } from "@/repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { CommentRepository } from "@/repositories/comment.repository";
import { UnitOfWork } from "@/database/UnitOfWork";
import { EventBus } from "@/application/common/buses/event.bus";
import { PostDeletedEvent } from "@/application/events/post/post.event";
import { createError } from "@/utils/errors";
import { isValidPublicId } from "@/utils/sanitizers";
import { IUser } from "@/types";

export interface UnrepostResult {
	message: string;
}

@injectable()
export class UnrepostPostCommandHandler implements ICommandHandler<UnrepostPostCommand, UnrepostResult> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("EventBus") private readonly eventBus: EventBus,
	) {}

	async execute(command: UnrepostPostCommand): Promise<UnrepostResult> {
		if (!isValidPublicId(command.userPublicId)) {
			throw createError("ValidationError", "Invalid userPublicId format");
		}

		const user = await this.userReadRepository.findByPublicId(command.userPublicId);
		if (!user) {
			throw createError("NotFoundError", `User with publicId ${command.userPublicId} not found`);
		}

		const targetPost = await this.postReadRepository.findByPublicId(command.targetPostPublicId);
		if (!targetPost) {
			throw createError("NotFoundError", `Post ${command.targetPostPublicId} not found`);
		}

		// Find the user's repost of the target post
		const userId = (user as IUser)._id as mongoose.Types.ObjectId;
		const repost = await this.postReadRepository.findOneByFilter({
			user: userId,
			repostOf: targetPost._id,
			type: "repost",
		});

		if (!repost) {
			throw createError("NotFoundError", "You have not reposted this post");
		}

		await this.unitOfWork.executeInTransaction(async (session) => {
			const repostInternalId = repost._id!.toString();
			await this.postWriteRepository.delete(repostInternalId, session);
			await this.commentRepository.deleteCommentsByPostId(repostInternalId, session);
			await this.postWriteRepository.updateRepostCount(targetPost._id!.toString(), -1, session);
		});

		// Fire event for cache invalidation after transaction commits
		await this.eventBus.publish(new PostDeletedEvent(repost.publicId, command.userPublicId));

		return { message: "Repost removed successfully" };
	}
}
