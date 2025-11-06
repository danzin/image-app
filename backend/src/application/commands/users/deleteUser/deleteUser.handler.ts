import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { DeleteUserCommand } from "./deleteUser.command";
import { UserRepository } from "../../../../repositories/user.repository";
import { ImageRepository } from "../../../../repositories/image.repository";
import { PostRepository } from "../../../../repositories/post.repository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { LikeRepository } from "../../../../repositories/like.repository";
import { FollowRepository } from "../../../../repositories/follow.repository";
import { FavoriteRepository } from "../../../../repositories/favorite.repository";
import { NotificationRepository } from "../../../../repositories/notification.respository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { UserPreferenceRepository } from "../../../../repositories/userPreference.repository";
import { ConversationRepository } from "../../../../repositories/conversation.repository";
import { MessageRepository } from "../../../../repositories/message.repository";
import { PostViewRepository } from "../../../../repositories/postView.repository";
import { IImageStorageService } from "../../../../types";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { createError } from "../../../../utils/errors";

@injectable()
export class DeleteUserCommandHandler implements ICommandHandler<DeleteUserCommand, void> {
	constructor(
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("LikeRepository") private readonly likeRepository: LikeRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("NotificationRepository") private readonly notificationRepository: NotificationRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("UserPreferenceRepository") private readonly userPreferenceRepository: UserPreferenceRepository,
		@inject("ConversationRepository") private readonly conversationRepository: ConversationRepository,
		@inject("MessageRepository") private readonly messageRepository: MessageRepository,
		@inject("PostViewRepository") private readonly postViewRepository: PostViewRepository,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork
	) {}

	async execute(command: DeleteUserCommand): Promise<void> {
		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.userRepository.findByPublicId(command.userPublicId, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}

				const userId = user.id;

				// delete all user-related cloud storage assets first (outside transaction)
				// this includes images, avatars, covers, etc.
				const cloudResult = await this.imageStorageService.deleteMany(user.publicId);
				if (cloudResult.result !== "ok") {
					console.warn("Failed to delete cloud assets:", cloudResult.message);
				}

				// delete all user relationships and content in proper order
				// delete comments first (no dependencies)
				await this.commentRepository.deleteCommentsByUserId(userId, session);

				// delete likes
				await this.likeRepository.deleteManyByUserId(userId, session);

				// delete favorites
				await this.favoriteRepository.deleteManyByUserId(userId, session);

				// delete post views
				await this.postViewRepository.deleteManyByUserId(userId, session);

				// delete posts (this will cascade to post-related data via post deletion handlers if needed)
				await this.postRepository.deleteManyByUserId(userId, session);

				// delete images
				await this.imageRepository.deleteMany(userId, session);

				// delete follows (both as follower and followee)
				await this.followRepository.deleteAllFollowsByUserId(userId, session);

				// delete user preferences
				await this.userPreferenceRepository.deleteManyByUserId(userId, session);

				// delete user actions
				await this.userActionRepository.deleteManyByUserId(userId, session);

				// delete notifications (both as receiver and as actor who triggered them)
				await this.notificationRepository.deleteManyByUserId(user.publicId, session);
				await this.notificationRepository.deleteManyByActorId(user.publicId, session);

				// handle conversations - delete if only 2 participants, otherwise just remove user
				const userConversations = await this.conversationRepository.findByParticipant(userId, session);

				for (const conversation of userConversations) {
					const conversationId = conversation.id || conversation._id?.toString();
					if (!conversationId) continue;

					if (conversation.participants.length <= 2) {
						// delete the entire conversation
						await this.conversationRepository.delete(conversationId, session);
					} else {
						// remove user from participants array
						await this.conversationRepository.removeParticipant(conversationId, userId, session);
					}
				}

				// delete messages sent by this user
				await this.messageRepository.deleteManyBySender(userId, session);

				// remove user from readBy arrays in other messages
				await this.messageRepository.removeUserFromReadBy(userId, session);

				// finally, delete the user
				await this.userRepository.delete(userId, session);
			});
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && "message" in error) {
				throw createError(
					(error as { name: string; message: string }).name,
					(error as { name: string; message: string }).message
				);
			}
			throw createError("InternalServerError", "An unknown error occurred during user deletion");
		}
	}
}
