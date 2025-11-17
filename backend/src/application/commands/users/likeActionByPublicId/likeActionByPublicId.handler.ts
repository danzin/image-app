import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { inject, injectable } from "tsyringe";
import { LikeActionByPublicIdCommand } from "./likeActionByPublicId.command";
import { IPost, PostDTO } from "../../../../types/index";
import { EventBus } from "../../../common/buses/event.bus";
import { UserInteractedWithPostEvent } from "../../../events/user/user-interaction.event";
import { PostRepository } from "../../../../repositories/post.repository";
import { PostLikeRepository } from "../../../../repositories/postLike.repository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { NotificationService } from "../../../../services/notification.service";
import { DTOService } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";
import { FeedInteractionHandler } from "../../../events/user/feed-interaction.handler";
import { ClientSession } from "mongoose";
import { UnitOfWork } from "../../../../database/UnitOfWork";

@injectable()
export class LikeActionByPublicIdCommandHandler implements ICommandHandler<LikeActionByPublicIdCommand, PostDTO> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("FeedInteractionHandler") private readonly feedInteractionHandler: FeedInteractionHandler,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(command: LikeActionByPublicIdCommand): Promise<PostDTO> {
		let isLikeAction = true;
		let postTags: string[] = [];
		let existingPost: IPost | null;
		let userMongoId: string;

		try {
			console.log(
				`[LIKEACTIONHANDLER]:\r\n  User public ID: ${command.userPublicId},
			 Post public ID: ${command.postPublicId} \r\n command: ${JSON.stringify(command)}`
			);
			const user = await this.userRepository.findByPublicId(command.userPublicId);
			if (!user) {
				throw createError("PathError", `User with public ID ${command.userPublicId} not found`);
			}
			// Get MongoDB _id from user document - handle both raw and transformed
			userMongoId = (user as any)._id ? (user as any)._id.toString() : (user as any).id?.toString();

			if (!userMongoId) {
				throw createError("PathError", `User internal ID not found for public ID ${command.userPublicId}`);
			}

			console.log("[LIKEACTIONHANDLER] user keys:", Object.keys(user));
			console.log("[LIKEACTIONHANDLER] user._id:", (user as any)._id);
			console.log("[LIKEACTIONHANDLER] user.username:", (user as any).username);

			const actorUsername = (user as any).username || (user as any).name || "Unknown";

			existingPost = await this.postRepository.findByPublicId(command.postPublicId);
			if (!existingPost) {
				throw createError("PathError", `Post with public ID ${command.postPublicId} not found`);
			}

			console.log("[LIKEACTIONHANDLER] existingPost keys:", Object.keys(existingPost));
			console.log("[LIKEACTIONHANDLER] existingPost._id:", (existingPost as any)._id);
			console.log("[LIKEACTIONHANDLER] existingPost.id:", (existingPost as any).id);

			postTags = Array.isArray((existingPost as any).tags)
				? (existingPost as any).tags.map((t: any) => t.tag ?? t)
				: [];

			// Get _id from the document - handle both Mongoose document and plain object
			const postInternalId = (existingPost as any)._id
				? (existingPost as any)._id.toString()
				: (existingPost as any).id?.toString() || null;

			if (!postInternalId) {
				console.error("[LIKEACTIONHANDLER] Post object:", existingPost);
				throw createError("PathError", `Post internal ID not found for public ID ${command.postPublicId}`);
			}

			const postOwner = (existingPost as any).user;
			const postOwnerPublicId =
				typeof postOwner === "object" && postOwner !== null && "publicId" in postOwner
					? (postOwner as any).publicId
					: (postOwner?.toString?.() ?? "");

			await this.unitOfWork.executeInTransaction(async (session) => {
				const existingLike = await this.postLikeRepository.hasUserLiked(postInternalId, userMongoId, session);

				if (existingLike) {
					await this.handleUnlike(command, userMongoId, postInternalId, session);
					isLikeAction = false;
				} else {
					await this.handleLike(command, userMongoId, existingPost!, actorUsername, session);
				}
				this.eventBus.queueTransactional(
					new UserInteractedWithPostEvent(
						command.userPublicId,
						isLikeAction ? "like" : "unlike",
						existingPost!.publicId,
						postTags,
						postOwnerPublicId
					),
					this.feedInteractionHandler
				);
			});

			const updatedPost = await this.postRepository.findByPublicId(command.postPublicId);
			if (!updatedPost) {
				throw createError("PathError", `Post with public ID ${command.postPublicId} not found after update`);
			}

			return this.dtoService.toPostDTO(updatedPost);
		} catch (error) {
			console.error(error);
			const errorName = error instanceof Error ? error.name : "UnknownError";
			const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
			throw createError(errorName, errorMessage, {
				operation: "LikeActionByPublicId",
				userId: command.userPublicId,
				postPublicId: command.postPublicId,
			});
		}
	}

	private async handleLike(
		command: LikeActionByPublicIdCommand,
		userMongoId: string,
		post: IPost,
		actorUsername: string,
		session: ClientSession
	) {
		const postId = (post as any)._id.toString();
		const added = await this.postLikeRepository.addLike(postId, userMongoId, session);
		if (!added) {
			throw createError("ConflictError", "like already exists for user and post");
		}

		await this.postRepository.updateLikeCount(postId, 1, session);

		await this.userActionRepository.logAction(userMongoId, "like", (post as any)._id.toString(), session);

		const postOwner = (post as any).user;
		const postOwnerPublicId =
			typeof postOwner === "object" && postOwner !== null && "publicId" in postOwner
				? (postOwner as any).publicId.toString()
				: postOwner?.toString?.();

		if (postOwnerPublicId && postOwnerPublicId !== command.userPublicId) {
			// get post preview (first 50 chars of body or image indicator)
			const postPreview = post.body
				? post.body.substring(0, 50) + (post.body.length > 50 ? "..." : "")
				: post.image
					? "[Image post]"
					: "[Post]";

			await this.notificationService.createNotification({
				receiverId: postOwnerPublicId,
				actionType: "like",
				actorId: command.userPublicId,
				actorUsername,
				targetId: post.publicId,
				targetType: "post",
				targetPreview: postPreview,
				session,
			});
		}
	}

	private async handleUnlike(
		command: LikeActionByPublicIdCommand,
		userMongoId: string,
		postId: string,
		session: ClientSession
	) {
		const removed = await this.postLikeRepository.removeLike(postId, userMongoId, session);
		if (!removed) {
			throw createError("NotFoundError", "like does not exist for user and post");
		}
		await this.userActionRepository.logAction(userMongoId, "unlike", postId, session);
		await this.postRepository.updateLikeCount(postId, -1, session);
	}
}
