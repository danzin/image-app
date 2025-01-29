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

}

