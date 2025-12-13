import { FollowRepository } from "../repositories/follow.repository";
import { NotificationService } from "./notification.service";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { UserRepository } from "../repositories/user.repository";
import { RedisService } from "./redis.service";
import { UnitOfWork } from "../database/UnitOfWork";
import { inject, injectable } from "tsyringe";
import { logger } from "../utils/winston";

@injectable()
export class FollowService {
	constructor(
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("RedisService") private readonly redisService: RedisService,
		@inject("UnitOfWork") private readonly unitOfWork: UnitOfWork
	) {}

	async followUser(followerId: string, followeeId: string): Promise<void | string> {
		if (await this.followRepository.isFollowing(followerId, followeeId)) return "Already following this user";

		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				// add follow relationship
				await this.followRepository.addFollow(followerId, followeeId, session);

				// update follower's "following" list
				await this.userRepository.update(followerId, { $addToSet: { following: followeeId } }, session);

				// update followee's "followers" list
				await this.userRepository.update(followeeId, { $addToSet: { followers: followerId } }, session);

				// log the follow action
				await this.userActionRepository.logAction(followerId, "follow", followeeId, session);
			});

			// post-commit: create notification for followee
			const follower = await this.userRepository.findById(followerId);
			const followee = await this.userRepository.findById(followeeId);

			if (follower && followee) {
				await this.notificationService.createNotification({
					receiverId: followee.publicId,
					actionType: "follow",
					actorId: follower.publicId,
					actorUsername: follower.username,
				});
			}

			// invalidate the follower's feed cache so they see the new content immediately
			await this.invalidateFollowerFeedCache(followerId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to follow user";
			throw createError("InternalServerError", errorMessage);
		}
	}

	async unfollowUser(followerId: string, followeeId: string): Promise<void | string> {
		if (!(await this.followRepository.isFollowing(followerId, followeeId))) return "Already unfollowed this user";

		try {
			await this.unitOfWork.executeInTransaction(async (session) => {
				// remove follow relationship
				await this.followRepository.removeFollow(followerId, followeeId, session);

				// update follower's "following" list
				await this.userRepository.update(followerId, { $pull: { following: followeeId } }, session);

				// update followee's "followers" list
				await this.userRepository.update(followeeId, { $pull: { followers: followerId } }, session);

				// log the unfollow action
				await this.userActionRepository.logAction(followerId, "unfollow", followeeId, session);
			});

			await this.invalidateFollowerFeedCache(followerId);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to unfollow user";
			throw createError("InternalServerError", errorMessage);
		}
	}

	async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
		try {
			const existingFollow = this.followRepository.isFollowing(followerId, followeeId);
			return existingFollow;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to check following status";
			throw createError("InternalServerError", errorMessage);
		}
	}

	/**
	 * Invalidate all feed-related cache for a user after follow/unfollow actions
	 * This ensures their feed updates immediately to reflect new or removed content
	 */
	private async invalidateFollowerFeedCache(userId: string): Promise<void> {
		try {
			// use tag-based invalidation for efficient cache clearing
			await this.redisService.invalidateByTags([
				`user_feed:${userId}`,
				`for_you_feed:${userId}`,
				"who_to_follow",
				`user_suggestions:${userId}`,
			]);

			logger.info(`Invalidated feed cache for user ${userId} after follow/unfollow action`);
		} catch (error) {
			console.error(`Error invalidating feed cache for user ${userId}:`, error);
		}
	}
}
