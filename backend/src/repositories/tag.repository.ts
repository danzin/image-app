import mongoose from "mongoose";
import { Tag } from "../models/image.model";
import { ITag } from "../types";

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

}