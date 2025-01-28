import mongoose, { ClientSession, Model } from "mongoose";
import { Tag } from "../models/image.model";
import { ITag } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class TagRepository {

  constructor(
    @inject('TagModel') private readonly model: Model<ITag>
  ) {
    this.model = Tag;
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

  async findById(tag: string): Promise<ITag | null> {
    return this.model.findById(tag).exec();
  }

  async create(tag: string, session?: ClientSession): Promise<ITag> {
    console.log(`creating item: ${tag}`)
    const doc = new this.model({tag: tag});
    if (session) doc.$session(session);
    return await doc.save();
  }

  async searchTags(searchQuery: string, session?: ClientSession): Promise<ITag[]> {
    try {
      const query = this.model.find({ tag: { $regex: searchQuery, $options: 'i' } });
      if(session) query.session(session);
      return await query.exec();
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

}