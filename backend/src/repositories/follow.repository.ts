import mongoose, { Model } from "mongoose";
import Follow from "../models/follow.model";
import { createError } from "../utils/errors";
import { IFollow } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class FollowRepository extends BaseRepository<IFollow>{

  constructor(
    @inject('FollowModel') model: Model<IFollow>
  ) {
    super(model)
  }

  async isFollowing(followerId: string, followeeId: string): Promise<boolean> {
    const existingFollow = await this.model.findOne({ followerId, followeeId });
    return !!existingFollow;
  }

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
