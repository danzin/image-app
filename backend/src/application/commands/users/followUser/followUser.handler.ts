import { inject, injectable } from "tsyringe";
import { FollowUserCommand } from "./followUser.command";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { FollowRepository } from "../../../../repositories/follow.repository";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { IUserWriteRepository } from "../../../../repositories/interfaces/IUserWriteRepository";
import { UserActionRepository } from "../../../../repositories/userAction.repository";
import { NotificationService } from "../../../../services/notification.service";
import { RedisService } from "../../../../services/redis.service";
import { createError } from "../../../../utils/errors";

export interface FollowUserResult {
	action: "followed" | "unfollowed";
}

@injectable()
export class FollowUserCommandHandler implements ICommandHandler<FollowUserCommand, FollowUserResult> {
	constructor(
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("UserWriteRepository") private readonly userWriteRepository: IUserWriteRepository,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("RedisService") private readonly redisService: RedisService
	) {}

	async execute(command: FollowUserCommand): Promise<FollowUserResult> {
		const { followerPublicId, followeePublicId } = command;

		const [follower, followee] = await Promise.all([
			this.userReadRepository.findByPublicId(followerPublicId),
			this.userReadRepository.findByPublicId(followeePublicId),
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
					// unfollow logic
					await this.followRepository.removeFollow(followerId, followeeId, session);
					await this.userWriteRepository.update(followerId, { $pull: { following: followeeId } }, session);
					await this.userWriteRepository.update(followeeId, { $pull: { followers: followerId } }, session);
					// decrement denormalized counts
					await this.userWriteRepository.updateFollowingCount(followerId, -1, session);
					await this.userWriteRepository.updateFollowerCount(followeeId, -1, session);

					await this.userActionRepository.logAction(followerId, "unfollow", followeeId, session);
				} else {
					// follow logic
					await this.followRepository.addFollow(followerId, followeeId, session);
					await this.userWriteRepository.update(followerId, { $addToSet: { following: followeeId } }, session);
					await this.userWriteRepository.update(followeeId, { $addToSet: { followers: followerId } }, session);
					// increment denormalized counts
					await this.userWriteRepository.updateFollowingCount(followerId, 1, session);
					await this.userWriteRepository.updateFollowerCount(followeeId, 1, session);

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

			// invalidate feed caches after transaction commits
			await this.invalidateFeedCaches(follower.publicId);
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

	private async invalidateFeedCaches(followerPublicId: string): Promise<void> {
		try {
			await this.redisService.invalidateByTags([
				`user_feed:${followerPublicId}`,
				`for_you_feed:${followerPublicId}`,
				"who_to_follow",
				`user_suggestions:${followerPublicId}`,
			]);
		} catch (error) {
			console.warn("failed to invalidate feed caches", { followerPublicId, error });
		}
	}
}
