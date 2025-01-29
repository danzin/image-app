import mongoose, { Model } from "mongoose";
import UserAction from "../models/userAction.model";
import { IUserAction } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class UserActionRepository extends BaseRepository<IUserAction> {

  constructor(@inject('UserActionModel') model: Model<IUserAction>) {
    super(model)
  }

  async logAction(userId: string, actionType: string, targetId: string): Promise<void> {
    const userAction = new this.model({ userId, actionType, targetId });
    await userAction.save();
  }

  async getActionsByUser(userId: string): Promise<IUserAction[]> {
    return this.model.find({ userId }).exec();
  }
}