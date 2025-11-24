import { inject, injectable } from "tsyringe";
import { FollowUserCommand } from "./followUser.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { FollowRepository } from "../../../../repositories/follow.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { NotificationService } from "../../../../services/notification.service";
import { createError } from "../../../../utils/errors";

export interface FollowUserResult {
	action: "followed" | "unfollowed";
}

@injectable()
export class FollowUserCommandHandler implements ICommandHandler<FollowUserCommand, FollowUserResult> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService
	) {}

	async execute(command: FollowUserCommand): Promise<FollowUserResult> {
		const { followerPublicId, followeePublicId } = command;

		const [follower, followee] = await Promise.all([
			this.userRepository.findByPublicId(followerPublicId),
			this.userRepository.findByPublicId(followeePublicId),
		]);

		if (!follower || !followee) {
			throw createError("NotFoundError", "One or both users not found");
		}

		if (follower.id === followee.id) {
			throw createError("ValidationError", "Cannot follow yourself");
		}

		const wasFollowing = await this.followRepository.isFollowing(follower.id, followee.id);

		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				const followerId = follower.id;
				const followeeId = followee.id;

				if (wasFollowing) {
					// Unfollow logic
					await this.followRepository.removeFollow(followerId, followeeId, session);
					await this.userRepository.update(followerId, { $pull: { following: followeeId } }, session);
					await this.userRepository.update(followeeId, { $pull: { followers: followerId } }, session);
					await this.userActionRepository.logAction(followerId, "unfollow", followeeId, session);
				} else {
					// Follow logic
					await this.followRepository.addFollow(followerId, followeeId, session);
					await this.userRepository.update(followerId, { $addToSet: { following: followeeId } }, session);
					await this.userRepository.update(followeeId, { $addToSet: { followers: followerId } }, session);
					await this.userActionRepository.logAction(followerId, "follow", followeeId, session);

					// for now I'll emit the websocket event inside the transaction
					await this.notificationService.createNotification({
						receiverId: followee.publicId,
						actionType: "follow",
						actorId: follower.publicId,
						actorUsername: follower.username,
						session,
					});
				}
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			throw createError("TransactionError", errorMessage, {
				function: "followUser",
				additionalInfo: "Transaction failed",
				originalError: error,
			});
		}

		return { action: wasFollowing ? "unfollowed" : "followed" };
	}
}
