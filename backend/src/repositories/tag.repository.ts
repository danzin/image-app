import mongoose, { ClientSession, Model } from "mongoose";
import { Tag } from "../models/image.model";
import { ITag } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class TagRepository extends BaseRepository<ITag> {

  constructor(
    @inject('TagModel') model: Model<ITag>
  ) {
    super(model)
  }


  async getAll(): Promise<ITag[] | null>{
    return this.model.find({}).exec()
  }

  // Find a tag by name
  async findByTag(tag: string, session?: ClientSession): Promise<ITag | null> {
    const query = this.model.findOne({tag})
    .populate('tag', 'tag');
  
  if (session) query.session(session);
    return await query.exec();
  }



  async searchTags(searchQuery: string, session?: ClientSession): Promise<ITag[]> {
    try {
      const query = this.model.find({ tag: { $regex: searchQuery,  } });
      if(session) query.session(session);
      return await query.exec();
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

}