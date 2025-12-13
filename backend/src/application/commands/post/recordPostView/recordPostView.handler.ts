import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";
import { RecordPostViewCommand } from "./recordPostView.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { IPostReadRepository } from "../../../../repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "../../../../repositories/interfaces/IPostWriteRepository";
import { PostViewRepository } from "../../../../repositories/postView.repository";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { FeedService } from "../../../../services/feed.service";
import { createError } from "../../../../utils/errors";
import { isValidPublicId } from "../../../../utils/sanitizers";
import {
	PostAuthorizationError,
	PostNotFoundError,
	UserNotFoundError,
	mapPostError,
} from "../../../errors/post.errors";

@injectable()
export class RecordPostViewCommandHandler implements ICommandHandler<RecordPostViewCommand, boolean> {
	constructor(
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("PostViewRepository") private readonly postViewRepository: PostViewRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("FeedService") private readonly feedService: FeedService
	) {}

	async execute(command: RecordPostViewCommand): Promise<boolean> {
		try {
			if (!isValidPublicId(command.postPublicId)) {
				throw createError("ValidationError", "Invalid postPublicId format");
			}

			if (!isValidPublicId(command.userPublicId)) {
				throw createError("ValidationError", "Invalid userPublicId format");
			}

			const post = await this.postReadRepository.findOneByPublicId(command.postPublicId);

			if (!post) {
				throw new PostNotFoundError();
			}

			const postId = post._id as mongoose.Types.ObjectId;

			const user = await this.userReadRepository.findByPublicId(command.userPublicId);

			if (!user) {
				throw new UserNotFoundError();
			}

			const userId = user._id as mongoose.Types.ObjectId;

			const isOwner =
				typeof (post as any).isOwnedBy === "function"
					? (post as any).isOwnedBy(userId)
					: post.user.toString() === userId.toString();
			if (isOwner) {
				return false;
			}

			if (typeof (user as any).canViewPost === "function" && !(user as any).canViewPost(post)) {
				throw new PostAuthorizationError("User cannot view this post");
			}

			if (typeof (post as any).canBeViewedBy === "function" && !(post as any).canBeViewedBy(user)) {
				throw new PostAuthorizationError("User cannot view this post");
			}

			const isNewView = await this.postViewRepository.recordView(postId, userId);

			if (isNewView) {
				await this.postWriteRepository.incrementViewCount(postId);

				const updatedPost = await this.postReadRepository.findOneByPublicId(command.postPublicId);
				if (updatedPost?.viewsCount !== undefined) {
					await this.feedService.updatePostViewMeta(command.postPublicId, updatedPost.viewsCount);
				}
			}

			return isNewView;
		} catch (error) {
			throw mapPostError(error, {
				action: "record-post-view",
				postPublicId: command.postPublicId,
				userPublicId: command.userPublicId,
			});
		}
	}
}
