import mongoose from "mongoose";
import { FollowRepository } from "../repositories/follow.repository";
import { NotificationService } from "./notification.service";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { UserRepository } from "../repositories/user.repository";
import { inject, injectable } from "tsyringe";

@injectable()
export class FollowService {
	constructor(
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("NotificationService") private readonly notificationService: NotificationService,
		@inject("UserActionRepository") private readonly userActionRepository: UserActionRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository
	) {}

	async followUser(followerId: string, followeeId: string): Promise<void | string> {
		if (await this.followRepository.isFollowing(followerId, followeeId)) return "Already following this user";
		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			//Add follow relationship
			await this.followRepository.addFollow(followerId, followeeId, session);

			//Update follower's "following" list
			await this.userRepository.update(followerId, { $addToSet: { following: followeeId } }, session);

			//Update followee's "followers" list
			await this.userRepository.update(followeeId, { $addToSet: { followers: followerId } }, session);

			//Create notification for followee
			await this.notificationService.createNotification({
				receiverId: followeeId,
				actionType: "follow",
				actorId: followerId,
				actorUsername: (await this.userRepository.findByPublicId(followerId))?.username,
			});

			await this.userActionRepository.logAction(followerId, "follow", followeeId);

			await session.commitTransaction();
		} catch (error) {
			await session.abortTransaction();
			const errorMessage = error instanceof Error ? error.message : "Failed to follow user";
			throw createError("InternalServerError", errorMessage);
		} finally {
			session.endSession();
		}
	}

	async unfollowUser(followerId: string, followeeId: string): Promise<void | string> {
		if (!(await this.followRepository.isFollowing(followerId, followeeId))) return "Already unfollowed this user";

		const session = await mongoose.startSession();
		session.startTransaction();

		try {
			//Remove follow relationship
			await this.followRepository.removeFollow(followerId, followeeId, session);

			//Update follower's "following" list
			await this.userRepository.update(followerId, { $pull: { following: followeeId } }, session);

			//Update followee's "followers" list
			await this.userRepository.update(followeeId, { $pull: { followers: followerId } }, session);

			//Log the unfollow action
			await this.userActionRepository.logAction(followerId, "unfollow", followeeId);

			await session.commitTransaction();
		} catch (error) {
			await session.abortTransaction();
			const errorMessage = error instanceof Error ? error.message : "Failed to follow user";
			throw createError("InternalServerError", errorMessage);
		} finally {
			session.endSession();
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
}
