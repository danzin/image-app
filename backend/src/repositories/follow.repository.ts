import mongoose, { Model } from "mongoose";
import { createError } from "../utils/errors";
import { IFollow } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class FollowRepository extends BaseRepository<IFollow> {
  
  constructor(
    @inject('FollowModel') model: Model<IFollow>
  ) {
    super(model);
  }

  /**
   * Checks if a user is following another user.
   * 
   * @param {string} followerId - The ID of the user who follows.
   * @param {string} followeeId - The ID of the user being followed.
   * @returns {Promise<boolean>} - Returns `true` if the user is following, otherwise `false`.
   */
  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const existingFollow = await this.model.findOne({ followerId, followeeId });
    return !!existingFollow;
  }

  /**
   * Creates a follow relationship between two users.
   * 
   * @param {string} followerId - The ID of the user who is following.
   * @param {string} followeeId - The ID of the user being followed.
   * @param {mongoose.ClientSession} [session] - Optional MongoDB transaction session.
   * @returns {Promise<IFollow>} - The newly created follow record.
   * @throws {Error} - Throws a "DuplicateError" if the follow relationship already exists.
   */
  async addFollow(
    followerId: string,
    followeeId: string,
    session?: mongoose.ClientSession
  ): Promise<IFollow> {
    // Prevent duplicate follow relationships
    if (await this.isFollowing(followerId, followeeId)) {
      throw createError("DuplicateError", "Already following this user");
    }

    const follow = await this.model.create([{ followerId, followeeId }], { session });
    return follow[0];
  }

  /**
   * Removes a follow relationship between two users.
   * 
   * @param {string} followerId - The ID of the user who is following.
   * @param {string} followeeId - The ID of the user being followed.
   * @param {mongoose.ClientSession} [session] - Optional MongoDB transaction session.
   * @returns {Promise<void>} - Resolves when the follow relationship is removed.
   * @throws {Error} - Throws a "NotFoundError" if the follow relationship does not exist.
   */
  async removeFollow(
    followerId: string,
    followeeId: string,
    session?: mongoose.ClientSession
  ): Promise<void> {

    // Ensure that the follow relationship exists before attempting to remove it
    if (!(await this.isFollowing(followerId, followeeId))) {
      throw createError("NotFoundError", "Not following this user");
    }

    // Remove the follow relationship, optionally within a transaction
    await this.model.deleteOne({ followerId, followeeId }, { session });
  }
}
