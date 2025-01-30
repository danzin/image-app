import mongoose, {Model, ClientSession} from "mongoose";
import Like from "../models/like.model";
import { createError } from "../utils/errors";
import { ILike } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class LikeRepository extends BaseRepository<ILike>{
  constructor(
    @inject('LikeModel') model: Model<ILike>
  ) {
    super(model)
  }

  
  async findByUserAndImage(userId: string, imageId: string, session?: ClientSession): Promise<ILike | null> {
    const query = this.model.findOne({userId, imageId});
    if(session) query.session(session);
    const result = await query.exec();
    return result
  }

  async deleteLike(userId: string, imageId: string, session?: ClientSession): Promise<boolean> {
    const query = this.model.findOneAndDelete({userId, imageId});
    if(session) query.session(session);
    const result = await query.exec();
    return result !== null;
  }

}

