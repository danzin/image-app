import mongoose from "mongoose";
import UserAction from "../models/userAction.model";
import { IUserAction } from "../types";

export class UserActionRepository {
  //here I don't think I really need a constructor 
  //because there are no other dependencies to initialize or necessary encapsulation to be done
  //so I omit the constructor as TS will automatically provide a default constructor 

  private model: mongoose.Model<IUserAction>;
  
  //but I'll do it anyway because I've been doing in everywhere else 
  constructor() {
    this.model = UserAction; // Initialize the model in the constructor
  }

  async logAction(userId: string, actionType: string, targetId: string): Promise<void> {
    const userAction = new this.model({ userId, actionType, targetId });
    await userAction.save();
  }

  async getActionsByUser(userId: string): Promise<IUserAction[]> {
    return this.model.find({ userId }).exec();
  }
}