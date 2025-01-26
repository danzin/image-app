import mongoose from "mongoose";
import { Tag } from "../models/image.model";
import { ITag } from "../types";
import { createError } from "../utils/errors";

export class TagRepository {
  private model: mongoose.Model<ITag>;

  constructor() {
    this.model = Tag;
  }

  // Find a tag by its name
  async findByTag(tag: string): Promise<ITag | null> {
    return this.model.findOne({ tag }).exec();
  }

  // Create a new tag
  async create(tag: string): Promise<ITag> {
    return this.model.create({ tag }); // Only provide the `tag` field
  }

  async searchTags(query: string): Promise<ITag[]> {
    try {
      return await this.model.find({ tag: { $regex: query, $options: 'i' } }).exec();
    } catch (error: any) {
      throw createError('InternalServerError', error.message);
    }
  }

}