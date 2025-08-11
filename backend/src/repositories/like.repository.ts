import mongoose, { Model, ClientSession } from "mongoose";
import { createError } from "../utils/errors";
import { ILike } from "../types";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class LikeRepository extends BaseRepository<ILike> {
	constructor(@inject("LikeModel") model: Model<ILike>) {
		super(model);
	}

	/**
	 * Finds a like record by user and image.
	 *
	 * @param {string} userId - The ID of the user who liked the image.
	 * @param {string} imageId - The ID of the liked image.
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<ILike | null>} - The found like record or `null` if not found.
	 * @throws {Error} - Throws a "DatabaseError" if the follow relationship already exists.
	 */
	async findByUserAndImage(userId: string, imageId: string, session?: ClientSession): Promise<ILike | null> {
		try {
			const query = this.model.findOne({ userId, imageId });
			if (session) query.session(session);

			const result = await query.exec();
			return result;
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
   * Deletes a like record for a specific user and image.
   * 
   * @param {string} userId - The ID of the user who liked the image.
   * @param {string} imageId - The ID of the liked image.
   * @param {ClientSession} [session] - Optional MongoDB transaction session.
   * @returns {Promise<boolean>} - Returns `true` if a like was deleted, otherwise `false`.
   * @throws {Error} - Throws a "DatabaseError" if the follow relationship already exists.

   */
	async deleteLike(userId: string, imageId: string, session?: ClientSession): Promise<boolean> {
		try {
			const query = this.model.findOneAndDelete({ userId, imageId });
			if (session) query.session(session);

			const result = await query.exec();
			return result !== null;
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}
}
