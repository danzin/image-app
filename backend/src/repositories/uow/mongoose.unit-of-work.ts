import mongoose from "mongoose";
import { IUnitOfWork } from "../../types";
import { UserRepository } from "../user.repository";
import { ImageRepository } from "../image.repository";

export class MongooseUnitOfWork implements IUnitOfWork {
  private session: mongoose.ClientSession;

  constructor(
    private connection: mongoose.Connection,
    public userRepository: UserRepository,
    public imageRepository: ImageRepository
  ) {}

  async begin() {
    this.session = await this.connection.startSession();
    this.session.startTransaction();
  }

  async commit() {
    await this.session.commitTransaction();
    await this.session.endSession();
  }
  

  async rollback() {
    await this.session.abortTransaction();
    await this.session.endSession();
  }
}
