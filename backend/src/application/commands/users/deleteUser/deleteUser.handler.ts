import { inject, injectable } from "tsyringe";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { DeleteUserCommand } from "./deleteUser.command";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "../../../../repositories/interfaces/IUserWriteRepository";
import { ImageRepository } from "../../../../repositories/image.repository";
import { IPostWriteRepository } from "../../../../repositories/interfaces/IPostWriteRepository";
import { CommentRepository } from "../../../../repositories/comment.repository";
import { FollowRepository } from "../../../../repositories/follow.repository";
import { FavoriteRepository } from "../../../../repositories/favorite.repository";
import { NotificationRepository } from "../../../../repositories/notification.respository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { UserPreferenceRepository } from "../../../../repositories/userPreference.repository";
import { ConversationRepository } from "../../../../repositories/conversation.repository";
import { MessageRepository } from "../../../../repositories/message.repository";
import { PostViewRepository } from "../../../../repositories/postView.repository";
import { PostLikeRepository } from "../../../../repositories/postLike.repository";
import { IImageStorageService } from "../../../../types";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { createError } from "../../../../utils/errors";
import { EventBus } from "../../../common/buses/event.bus";
import { UserDeletedEvent } from "../../../events/user/user-interaction.event";

@injectable()
export class DeleteUserCommandHandler implements ICommandHandler<DeleteUserCommand, void> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("PostWriteRepository") private readonly postWriteRepository: IPostWriteRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("CommentRepository") private readonly commentRepository: CommentRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("NotificationRepository") private readonly notificationRepository: NotificationRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("UserPreferenceRepository") private readonly userPreferenceRepository: UserPreferenceRepository,
		@inject("ConversationRepository") private readonly conversationRepository: ConversationRepository,
		@inject("MessageRepository") private readonly messageRepository: MessageRepository,
		@inject("PostViewRepository") private readonly postViewRepository: PostViewRepository,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("EventBus") private readonly eventBus: EventBus
	) {}

	async execute(command: DeleteUserCommand): Promise<void> {
		// capture follower public IDs before deletion for cache invalidation
		let followerPublicIds: string[] = [];
		let userPublicId: string = command.userPublicId;
		let userId: string = "";

		try {
			// get followers before transaction since findUsersFollowing doesn't support sessions
			const followers = await this.userReadRepository.findUsersFollowing(command.userPublicId);
			followerPublicIds = followers.map((f) => f.publicId);

			await this.unitOfWork.executeInTransaction(async (session) => {
				const user = await this.userReadRepository.findByPublicId(command.userPublicId, session);
				if (!user) {
					throw createError("NotFoundError", "User not found");
				}

				userId = user.id;
				userPublicId = user.publicId;

				// delete all user-related cloud storage assets first (outside transaction)
				// this includes images, avatars, covers, etc.
				const cloudResult = await this.imageStorageService.deleteMany(user.publicId);
				if (cloudResult.result !== "ok") {
					console.warn("Failed to delete cloud assets:", cloudResult.message);
				}

				// delete all user relationships and content in proper order
				await this.commentRepository.deleteCommentsByUserId(userId, session);

				await this.postLikeRepository.removeLikesByUser(userId, session);

				await this.favoriteRepository.deleteManyByUserId(userId, session);

				await this.postViewRepository.deleteManyByUserId(userId, session);

				await this.postWriteRepository.deleteManyByUserId(userId, session);

				await this.imageRepository.deleteMany(userId, session);

				await this.followRepository.deleteAllFollowsByUserId(userId, session);

				await this.userPreferenceRepository.deleteManyByUserId(userId, session);

				await this.userActionRepository.deleteManyByUserId(userId, session);

				await this.notificationRepository.deleteManyByUserId(user.publicId, session);
				await this.notificationRepository.deleteManyByActorId(user.publicId, session);

				const userConversations = await this.conversationRepository.findByParticipant(userId, session);

				for (const conversation of userConversations) {
					const conversationId = conversation.id || conversation._id?.toString();
					if (!conversationId) continue;

					if (conversation.participants.length <= 2) {
						// delete the conversation
						await this.conversationRepository.delete(conversationId, session);
					} else {
						// remove user from participants array
						await this.conversationRepository.removeParticipant(conversationId, userId, session);
					}
				}

				await this.messageRepository.deleteManyBySender(userId, session);

				await this.messageRepository.removeUserFromReadBy(userId, session);

				// finally, delete the user
				await this.userWriteRepository.delete(userId, session);
			});

			// emit event after successful deletion to trigger cache cleanup
			await this.eventBus.publish(new UserDeletedEvent(userPublicId, userId, followerPublicIds));
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
