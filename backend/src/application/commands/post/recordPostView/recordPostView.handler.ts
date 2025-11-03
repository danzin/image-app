import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";
import { RecordPostViewCommand } from "./recordPostView.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { PostRepository } from "../../../../repositories/post.repository";
import { PostViewRepository } from "../../../../repositories/postView.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { FeedService } from "../../../../services/feed.service";
import { createError } from "../../../../utils/errors";
import { isValidPublicId } from "../../../../utils/sanitizers";

@injectable()
export class RecordPostViewCommandHandler implements ICommandHandler<RecordPostViewCommand, boolean> {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("PostViewRepository") private readonly postViewRepository: PostViewRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("FeedService") private readonly feedService: FeedService
	) {}

	async execute(command: RecordPostViewCommand): Promise<boolean> {
		// validate publicId formats
		if (!isValidPublicId(command.postPublicId)) {
			throw createError("ValidationError", "Invalid postPublicId format");
		}

		if (!isValidPublicId(command.userPublicId)) {
			throw createError("ValidationError", "Invalid userPublicId format");
		}

		// resolve post by publicId (without transaction for better performance)
		const post = await this.postRepository.findOneByPublicId(command.postPublicId);

		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}

		const postId = post._id as mongoose.Types.ObjectId;

		// resolve user
		const user = await this.userRepository.findByPublicId(command.userPublicId);

		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const userId = user._id as mongoose.Types.ObjectId;

		// don't count views from the post owner
		if (post.user.toString() === userId.toString()) {
			return false;
		}

		// record the view (returns false if already viewed)
		// this handles duplicate key errors gracefully
		const isNewView = await this.postViewRepository.recordView(postId, userId);

		// increment viewsCount only if this is a new unique view
		if (isNewView) {
			await this.postRepository.incrementViewCount(postId);

			// update the post meta cache with new view count
			const updatedPost = await this.postRepository.findOneByPublicId(command.postPublicId);
			if (updatedPost?.viewsCount !== undefined) {
				await this.feedService.updatePostViewMeta(command.postPublicId, updatedPost.viewsCount);
			}
		}

		return isNewView;
	}
}
