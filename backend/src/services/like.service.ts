import mongoose from "mongoose";
import { LikeRepository } from "../repositories/like.repository";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class LikeService  {

  constructor(@inject('LikeRepository') private readonly likeRepository: LikeRepository) 
  {}

  // async likeImage(userId: string, imageId: string): Promise<{ message: string }> {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     await this.likeRepository.addLike(userId, imageId, session);

  //     await this.likeRepository.findByIdAndUpdate(
  //       imageId,
  //       { $inc: { likesCount: 1 } },
  //       { session }
  //     );

  //     await session.commitTransaction();
  //     return { message: "Image liked successfully" };
  //   } catch (error) {
  //     await session.abortTransaction();
  //     throw createError("TransactionError", "Failed to like image");
  //   } finally {
  //     session.endSession();
  //   }
  // }

  // async unlikeImage(userId: string, imageId: string): Promise<{ message: string }> {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     await this.likeRepository.removeLike(userId, imageId, session);

  //     // Decrement the like count on the image
  //     await this.likeRepository.findByIdAndUpdate(
  //       imageId,
  //       { $inc: { likesCount: -1 } },
  //       { session }
  //     );

  //     await session.commitTransaction();
  //     return { message: "Image unliked successfully" };
  //   } catch (error) {
  //     await session.abortTransaction();
  //     throw createError("TransactionError", "Failed to unlike image");
  //   } finally {
  //     session.endSession();
  //   }
  // }
}
