import { inject, injectable } from "tsyringe";
import { Model } from "mongoose";
import { ICommandHandler } from "@/application/common/interfaces/command-handler.interface";
import { DeleteUserCommand } from "./deleteUser.command";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "@/repositories/interfaces/IUserWriteRepository";
import { ImageRepository } from "@/repositories/image.repository";
import { IPostWriteRepository } from "@/repositories/interfaces/IPostWriteRepository";
import { CommentRepository } from "@/repositories/comment.repository";
import { FollowRepository } from "@/repositories/follow.repository";
import { FavoriteRepository } from "@/repositories/favorite.repository";
import { NotificationRepository } from "@/repositories/notification.respository";
import { UserActionRepository } from "@/repositories/userAction.repository";
import { UserPreferenceRepository } from "@/repositories/userPreference.repository";
import { ConversationRepository } from "@/repositories/conversation.repository";
import { MessageRepository } from "@/repositories/message.repository";
import { PostViewRepository } from "@/repositories/postView.repository";
import { PostLikeRepository } from "@/repositories/postLike.repository";
import { CommunityRepository } from "@/repositories/community.repository";
import { CommunityMemberRepository } from "@/repositories/communityMember.repository";
import { IImageStorageService, IUser } from "@/types";
import { UnitOfWork } from "@/database/UnitOfWork";
import { createError } from "@/utils/errors";
import { EventBus } from "@/application/common/buses/event.bus";
import { UserDeletedEvent } from "@/application/events/user/user-interaction.event";

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
		@inject("CommunityRepository") private readonly communityRepository: CommunityRepository,
		@inject("CommunityMemberRepository") private readonly communityMemberRepository: CommunityMemberRepository,
		@inject("ImageStorageService") private readonly imageStorageService: IImageStorageService,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("EventBus") private readonly eventBus: EventBus,
		@inject("UserModel") private readonly userModel: Model<IUser>,
	) {}

	async execute(command: DeleteUserCommand): Promise<void> {
		// verify password before proceeding with deletion (unless admin bypass)
		if (!command.skipPasswordVerification) {
			if (!command.password) {
				throw createError("ValidationError", "Password is required for account deletion");
			}

			const userWithPassword = await this.userModel
				.findOne({ publicId: command.userPublicId })
				.select("+password")
				.exec();

			if (!userWithPassword) {
				throw createError("NotFoundError", "User not found");
			}

			const isPasswordValid = await userWithPassword.comparePassword(command.password);
			if (!isPasswordValid) {
				throw createError("AuthenticationError", "Invalid password");
			}
		}

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

				// get users that the deleted user was following (they need followerCount decremented)
				const followingIds = await this.followRepository.getFollowingObjectIds(userId);

				// get users that were following the deleted user (they need followingCount decremented)
				const followerIds = await this.followRepository.getFollowerObjectIds(userId);

				// delete all user relationships and content in proper order
				await this.commentRepository.deleteCommentsByUserId(userId, session);

				await this.postLikeRepository.removeLikesByUser(userId, session);

				await this.favoriteRepository.deleteManyByUserId(userId, session);

				await this.postViewRepository.deleteManyByUserId(userId, session);

				await this.postWriteRepository.deleteManyByUserId(userId, session);

				await this.imageRepository.deleteMany(userId, session);

				await this.followRepository.deleteAllFollowsByUserId(userId, session);

				for (const followedUserId of followingIds) {
					await this.userWriteRepository.updateFollowerCount(followedUserId, -1, session);
				}

				for (const followerUserId of followerIds) {
					await this.userWriteRepository.updateFollowingCount(followerUserId, -1, session);
				}

				await this.userPreferenceRepository.deleteManyByUserId(userId, session);

				await this.userActionRepository.deleteManyByUserId(userId, session);

				await this.notificationRepository.deleteManyByUserId(user.publicId, session);
				await this.notificationRepository.deleteManyByActorId(user.publicId, session);

				// remove user from communities and update member counts
				if (user.joinedCommunities && user.joinedCommunities.length > 0) {
					for (const community of user.joinedCommunities) {
						if (community._id) {
							await this.communityRepository.update(
								community._id.toString(),
								{ $inc: { "stats.memberCount": -1 } } as any,
								session
							);
						}
					}
				}
				await this.communityMemberRepository.deleteManyByUserId(userId, session);

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

			// delete all user-related cloud storage assets (after successful transaction commit)
			// this includes images, avatars, covers, etc.
			try {
				const cloudResult = await this.imageStorageService.deleteMany(userPublicId);
				if (cloudResult.result !== "ok") {
					console.warn("Failed to delete cloud assets:", cloudResult.message);
				}
			} catch (cloudError) {
				console.warn("Error during cloud assets deletion:", cloudError);
			}

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
