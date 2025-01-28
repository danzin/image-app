import mongoose from "mongoose";
import { FollowRepository } from "../repositories/follow.repository";
import { NotificationService } from "./notification.service";
import { UserActionRepository } from "../repositories/userAction.repository";
import { createError } from "../utils/errors";
import { UserRepository } from "../repositories/user.repository";

export class FollowService {
  private followRepository: FollowRepository;
  private notificationService: NotificationService;
  private userActionRepository: UserActionRepository;
  private userRepository: UserRepository;

  constructor() {
    this.followRepository = new FollowRepository;
    this.notificationService = new NotificationService;
    this.userActionRepository = new UserActionRepository;
    this.userRepository = new UserRepository;
  }

  async followUser(followerId: string, followeeId: string): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Add follow relationship
      await this.followRepository.addFollow(followerId, followeeId, session);

      // 2. Update follower's "following" list
      await this.userRepository.findByIdAndUpdate(
        followerId,
        { $addToSet: { following: followeeId } },
        { session }
      );

      // 3. Update followee's "followers" list
      await mongoose.model("User").findByIdAndUpdate(
        followeeId,
        { $addToSet: { followers: followerId } },
        { session }
      );

      // 4. Create notification for followee
      await this.notificationService.createNotification({
        userId: followeeId, // The user being followed
        actionType: "follow",
        actorId: followerId, // The user who initiated the follow
      });

      // 5. Log the follow action
      await this.userActionRepository.logAction(followerId, "follow", followeeId);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw createError("InternalServerError", error.message || "Failed to follow user");
    } finally {
      session.endSession();
    }
  }

  async unfollowUser(followerId: string, followeeId: string): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Remove follow relationship
      await this.followRepository.removeFollow(followerId, followeeId, session);

      // 2. Update follower's "following" list
      await mongoose.model("User").findByIdAndUpdate(
        followerId,
        { $pull: { following: followeeId } },
        { session }
      );

      // 3. Update followee's "followers" list
      await mongoose.model("User").findByIdAndUpdate(
        followeeId,
        { $pull: { followers: followerId } },
        { session }
      );

      // 4. Log the unfollow action
      await this.userActionRepository.logAction(followerId, "unfollow", followeeId);

      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      throw createError("InternalServerError", error.message || "Failed to unfollow user");
    } finally {
      session.endSession();
    }
  }
}
