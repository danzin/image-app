import { inject, injectable } from "tsyringe";
import mongoose, { ClientSession } from "mongoose";
import { DeletePostCommand } from "./deletePost.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { PostRepository } from "../../../../repositories/post.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { TagService } from "../../../../services/tag.service";
import { ImageService } from "../../../../services/image.service";
import { RedisService } from "../../../../services/redis.service";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { EventBus } from "../../../common/buses/event.bus";
import { PostDeletedEvent } from "../../../events/post/post.event";
import { createError } from "../../../../utils/errors";
import { IPost } from "../../../../types";

export interface DeletePostResult {
	message: string;
}

@injectable()
export class DeletePostCommandHandler implements ICommandHandler<DeletePostCommand, DeletePostResult> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("TagService") private readonly tagService: TagService,
		@inject("ImageService") private readonly imageService: ImageService,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("EventBus") private readonly eventBus: EventBus
	) {}

	async execute(command: DeletePostCommand): Promise<DeletePostResult> {
		let postAuthorPublicId: string | undefined;

		await this.unitOfWork.executeInTransaction(async (session) => {
			const post = await this.validatePostExists(command.postPublicId, session);
			const user = await this.validateUserExists(command.requesterPublicId, session);

			const { postOwnerInternalId, postOwnerPublicId } = this.extractPostOwnerInfo(post);
			const postOwnerDoc = postOwnerInternalId
				? await this.userRepository.findById(postOwnerInternalId, session)
				: null;

			postAuthorPublicId = postOwnerDoc?.publicId ?? postOwnerPublicId ?? command.requesterPublicId;

			this.validateDeletePermission(user, postOwnerInternalId);

			// delete associated image if present
			await this.handleImageDeletion(
				post,
				command.requesterPublicId,
				postOwnerInternalId,
				postOwnerDoc?.publicId ?? postOwnerPublicId ?? command.requesterPublicId,
				session
			);

			// delete post and associated comments
			await this.deletePostAndComments(post, session);
			if (postOwnerInternalId) {
				await this.userRepository.update(postOwnerInternalId, { $inc: { postCount: -1 } }, session);
			}

			// decrement tag usage counts
			await this.decrementTagUsage(post, session);
		});

		await this.invalidateCache(command.requesterPublicId);
		await this.publishDeleteEvent(command.postPublicId, postAuthorPublicId ?? command.requesterPublicId);

		return { message: "Post deleted successfully" };
	}

	private async validatePostExists(publicId: string, session: ClientSession): Promise<IPost> {
		const post = await this.postRepository.findByPublicId(publicId, session);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}
		return post;
	}

	private async validateUserExists(publicId: string, session: ClientSession): Promise<any> {
		const user = await this.userRepository.findByPublicId(publicId, session);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}
		return user;
	}

	private extractPostOwnerInfo(post: IPost): { postOwnerInternalId: string; postOwnerPublicId?: string } {
		const rawUser = (post as any).user;
		const authorSnapshot = (post as any).author;

		let postOwnerInternalId = "";
		if (rawUser && typeof rawUser === "object" && "_id" in rawUser) {
			postOwnerInternalId = (rawUser as any)._id?.toString?.() ?? "";
		} else if (authorSnapshot?._id) {
			postOwnerInternalId = authorSnapshot._id.toString();
		} else if (typeof rawUser?.toString === "function") {
			postOwnerInternalId = rawUser.toString();
		}

		const postOwnerPublicId =
			typeof rawUser === "object" && rawUser !== null && "publicId" in rawUser
				? (rawUser as any).publicId
				: authorSnapshot?.publicId;

		return { postOwnerInternalId, postOwnerPublicId };
	}

	private validateDeletePermission(user: any, postOwnerInternalId: string): void {
		const requesterId = (user as any)._id.toString();

		if (postOwnerInternalId !== requesterId && !user.isAdmin) {
			throw createError("ForbiddenError", "You do not have permission to delete this post");
		}
	}

	private async handleImageDeletion(
		post: IPost,
		requesterPublicId: string,
		ownerInternalId: string,
		ownerPublicId: string,
		session: ClientSession
	): Promise<void> {
		if (!post.image) {
			return;
		}

		const rawImage = post.image as any;
		const imageId = rawImage?._id ? rawImage._id.toString() : rawImage?.toString?.();

		if (!imageId) {
			console.warn(`[DeletePostHandler] Post ${post.publicId} has image reference but no valid imageId`);
			return;
		}

		try {
			await this.imageService.removePostAttachment({
				imageId,
				requesterPublicId,
				ownerInternalId: ownerInternalId || undefined,
				ownerPublicId,
				session,
			});
		} catch (error) {
			// log the error but don't fail the entire post deletion
			// the image cleanup can be handled by a separate maintenance job if needed
			console.error(`[DeletePostHandler] Failed to delete image ${imageId} for post ${post.publicId}:`, error);
		}
	}

	private async deletePostAndComments(post: IPost, session: ClientSession): Promise<void> {
		const postInternalId = (post as any)._id.toString();
		await this.postRepository.delete(postInternalId, session);
		await this.commentRepository.deleteCommentsByPostId(postInternalId, session);
	}

	private async decrementTagUsage(post: IPost, session: ClientSession): Promise<void> {
		if (!post.tags || post.tags.length === 0) {
			return;
		}

		const tagIds = (post.tags as any[]).map((tag) => {
			if (typeof tag === "object" && tag !== null && "_id" in tag) {
				return new mongoose.Types.ObjectId((tag as any)._id);
			}
			return new mongoose.Types.ObjectId(tag);
		});

		await this.tagService.decrementUsage(tagIds, session);
	}

	private async invalidateCache(userPublicId: string): Promise<void> {
		await this.redisService.invalidateByTags([`user_feed:${userPublicId}`]);
	}

	private async publishDeleteEvent(postPublicId: string, authorPublicId: string): Promise<void> {
		await this.eventBus.publish(new PostDeletedEvent(postPublicId, authorPublicId));
	}
}
