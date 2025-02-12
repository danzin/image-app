import mongoose, { ClientSession, Model } from "mongoose";
import { Tag } from "../models/image.model";
import { ITag } from "../types";
import { AppError, createError } from "../utils/errors";
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
      if (!searchQuery || searchQuery.length < 3) {
        throw createError('ValidationError', 'Search query must be at least 3 characters.', { searchQuery });
      }
  
      const query = this.model.find({ tag: { $regex: searchQuery } });
      if (session) query.session(session);
      return await query.exec();
    } catch (error: any) {
      if (error.name === 'MongoError') {
        if (error.code === 11000) {
          throw createError('DuplicateError', 'Tag already exists.', { searchQuery });
        } else {
          throw createError('DatabaseError', 'A database error occurred.', { searchQuery, mongoErrorCode: error.code, mongoErrorMessage: error.message });
        }
      } else if (error.name === 'ValidationError') {
        throw error;
      } else {
        console.error("Unexpected error in searchTags:", error);
        throw createError('InternalServerError', 'An unexpected error occurred.', { searchQuery, errorMessage: error.message, errorStack: error.stack });
      }
    }
  }

}