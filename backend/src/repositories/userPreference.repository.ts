import { inject, injectable } from 'tsyringe';
import { BaseRepository } from './base.repository';
import { Model } from "mongoose";
import { IUserPreference } from '../types';
import { createError } from '../utils/errors';

@injectable()
export class UserPreferenceRepository extends BaseRepository<IUserPreference> {
  constructor(@inject('UserPreferenceModel') model: Model<IUserPreference>) {
    super(model);
  }

  async getTopUserTags(userId: string, limit = 15): Promise<IUserPreference[]> {
    try {
      return this.model.find({ userId })
        .sort({ score: -1 })
        .limit(limit)
        .exec();
      
    } catch (error) {
      console.error(error)
      throw createError(error.name, error.message)
    }
  }

  async incrementTagScore(userId: string, tag: string, increment = 1): Promise<IUserPreference> {
    try {
      return this.model.findOneAndUpdate(
        { userId, tag },
        { 
          $inc: { score: increment },
          $set: { lastInteraction: new Date() }
        },
        { upsert: true, new: true }
      );
      
    } catch (error) {
      throw createError(error.name, error.message)
    }
  }

  async decrementTagScore(userId: string, tag: string, decrement = 1): Promise<IUserPreference> {
    return this.model.findOneAndUpdate(
      { userId, tag },
      { 
        $inc: { score: -decrement },
        $set: { lastInteraction: new Date() }
      },
      { upsert: true, new: true }
    );
  }
}

