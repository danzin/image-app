import mongoose from "mongoose";
import Follow from "../models/follow.model";
import { createError } from "../utils/errors";
import { IFollow } from "../types";

export class FollowRepository {
  private model: mongoose.Model<IFollow>;

  constructor() {
    this.model = Follow;
  }

  // Check if a follow relationship exists
  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const existingFollow = await this.model.findOne({ followerId, followeeId });
    return !!existingFollow;
  }

  // Add a follow relationship (no transaction logic here)
  async addFollow(
    followerId: string,
    followeeId: string,
    session?: mongoose.ClientSession
  ): Promise<IFollow> {
    if (await this.isFollowing(followerId, followeeId)) {
      throw createError("DuplicateError", "Already following this user");
    }

    const follow = await this.model.create([{ followerId, followeeId }], { session });
    return follow[0];
  }

  // Remove a follow relationship (no transaction logic here)
  async removeFollow(
    followerId: string,
    followeeId: string,
    session?: mongoose.ClientSession
  ): Promise<void> {
    if (!(await this.isFollowing(followerId, followeeId))) {
      throw createError("NotFoundError", "Not following this user");
    }

    await this.model.deleteOne({ followerId, followeeId }, { session });
  }
}
