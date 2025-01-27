import mongoose, {Model, ClientSession} from "mongoose";
import Like from "../models/like.model";
import { createError } from "../utils/errors";
import { ILike } from "../types";

export class LikeRepository {
  constructor(private readonly model: Model<ILike>) {}

  async create(userId: string, imageId: string, session?: ClientSession): Promise<void> {
    const doc = new this.model({ userId, imageId });
    if (session) doc.$session(session);
    await doc.save();
  }

  async delete(userId: string, imageId: string, session?: ClientSession): Promise<void> {
    const query = this.model.deleteOne({ userId, imageId });
    if (session) query.session(session);
    await query.exec();
  }
}

