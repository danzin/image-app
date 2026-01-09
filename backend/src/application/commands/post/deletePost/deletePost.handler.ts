import { inject, injectable } from "tsyringe";
import mongoose, { ClientSession } from "mongoose";
import { DeletePostCommand } from "./deletePost.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { IPostReadRepository } from "../../../../repositories/interfaces/IPostReadRepository";
import { IPostWriteRepository } from "../../../../repositories/interfaces/IPostWriteRepository";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "../../../../repositories/interfaces/IUserWriteRepository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { CommunityMemberRepository } from "../../../../repositories/communityMember.repository";
import { TagService } from "../../../../services/tag.service";
import { ImageService } from "../../../../services/image.service";
import { RedisService } from "../../../../services/redis.service";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { EventBus } from "../../../common/buses/event.bus";
import { PostDeletedEvent } from "../../../events/post/post.event";
import { IPost, IUser } from "../../../../types";
import {
	PostAuthorizationError,
	PostNotFoundError,
	UserNotFoundError,
	mapPostError,
} from "../../../errors/post.errors";

export interface DeletePostResult {
	message: string;
}

@injectable()
export class DeletePostCommandHandler implements ICommandHandler<DeletePostCommand, DeletePostResult> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("CommunityMemberRepository") private readonly communityMemberRepository: CommunityMemberRepository,
		@inject("TagService") private readonly tagService: TagService,
		@inject("ImageService") private readonly imageService: ImageService,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("EventBus") private readonly eventBus: EventBus
	) {}

	async execute(command: DeletePostCommand): Promise<DeletePostResult> {
		let postAuthorPublicId: string | undefined;

		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const post = await this.validatePostExists(command.postPublicId, session);
				const user = await this.validateUserExists(command.requesterPublicId, session);

				const { postOwnerInternalId, postOwnerPublicId } = this.extractPostOwnerInfo(post);
				const postOwnerDoc = postOwnerInternalId
					? await this.userReadRepository.findById(postOwnerInternalId, session)
					: null;

				postAuthorPublicId = postOwnerDoc?.publicId ?? postOwnerPublicId ?? command.requesterPublicId;

				await this.validateDeletePermission(user, post, session);

				await this.handleImageDeletion(
					post,
					command.requesterPublicId,
					postOwnerInternalId,
					postOwnerDoc?.publicId ?? postOwnerPublicId ?? command.requesterPublicId,
					session
				);

				await this.deletePostAndComments(post, session);
				if (postOwnerInternalId) {
					await this.userWriteRepository.update(postOwnerInternalId, { $inc: { postCount: -1 } }, session);
				}

				await this.decrementTagUsage(post, session);
			});

			await this.invalidateCache(command.requesterPublicId);
			await this.publishDeleteEvent(command.postPublicId, postAuthorPublicId ?? command.requesterPublicId);

			return { message: "Post deleted successfully" };
		} catch (error) {
			throw mapPostError(error, {
				action: "delete-post",
				postPublicId: command.postPublicId,
				requesterPublicId: command.requesterPublicId,
				postAuthorPublicId,
			});
		}
	}

	private async validatePostExists(publicId: string, session: ClientSession): Promise<IPost> {
		const post = await this.postReadRepository.findByPublicId(publicId, session);
		if (!post) {
			throw new PostNotFoundError();
		}
		return post;
	}

	private async validateUserExists(publicId: string, session: ClientSession): Promise<IUser> {
		const user = await this.userReadRepository.findByPublicId(publicId, session);
		if (!user) {
			throw new UserNotFoundError();
		}
		return user;
	}

	private extractPostOwnerInfo(post: IPost): { postOwnerInternalId: string; postOwnerPublicId?: string } {
		// In lean mode (findByPublicId), 'user' is an ObjectId and 'author' is the snapshot
		const userId = post.user as unknown as mongoose.Types.ObjectId;
		const authorSnapshot = post.author;

		const postOwnerInternalId = userId ? userId.toString() : (authorSnapshot?._id?.toString() ?? "");
		const postOwnerPublicId = authorSnapshot?.publicId;

		return { postOwnerInternalId, postOwnerPublicId };
	}

	private async validateDeletePermission(user: IUser, post: IPost, session: ClientSession): Promise<void> {
		const requesterId = user._id!.toString();
		// post.user is an ObjectId in lean mode
		const ownerId = (post.user as unknown as mongoose.Types.ObjectId).toString();
		const isOwner = ownerId === requesterId;

		if (isOwner || user.isAdmin) {
			return;
		}

		if (post.communityId) {
			const member = await this.communityMemberRepository.findByCommunityAndUser(post.communityId, user._id as string);
			if (member && (member.role === "admin" || member.role === "moderator")) {
				return;
			}
		}

		throw new PostAuthorizationError();
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

		// Ensure we handle both populated object and direct ID (though findByPublicId populates it)
		const imageObj = post.image as any;
		const imageId = imageObj._id ? imageObj._id.toString() : imageObj.toString();

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
		const postInternalId = post._id!.toString();
		await this.postWriteRepository.delete(postInternalId, session);
		await this.commentRepository.deleteCommentsByPostId(postInternalId, session);
	}

	private async decrementTagUsage(post: IPost, session: ClientSession): Promise<void> {
		if (!post.tags || post.tags.length === 0) {
			return;
		}

		// In lean mode (findByPublicId), tags are populated as plain objects
		const tagIds = post.tags.map((tag: any) => {
			const id = tag._id || tag; // Handle both populated object and direct ID (fallback)
			return new mongoose.Types.ObjectId(id);
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
