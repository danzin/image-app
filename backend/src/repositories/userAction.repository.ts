import mongoose, { ClientSession, Model } from "mongoose";
import UserAction from "../models/userAction.model";
import { IUserAction } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";
import { createError } from "../utils/errors";

@injectable()
export class UserActionRepository extends BaseRepository<IUserAction> {

  constructor(@inject('UserActionModel') model: Model<IUserAction>) {
    super(model)
  }

  async logAction(userId: string, actionType: string, targetId: string, session?: ClientSession): Promise<IUserAction> {
    try {
      const doc = new this.model({userId, actionType, targetId});
      // if(session) doc.$session(session);
      return await doc.save({ session });     
    } catch (error) {
      throw createError(error.name, error.message)      
    }
  }

  async getActionsByUser(userId: string): Promise<IUserAction[]> {
    return this.model.find({ userId }).exec();
  }
}