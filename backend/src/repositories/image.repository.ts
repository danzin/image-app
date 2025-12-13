import mongoose, { Model, ClientSession, Types } from "mongoose";
import { BaseRepository } from "./base.repository";
import { IImage } from "../types";
import { createError, isNamedError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { logger } from "../utils/winston";

@injectable()
export class ImageRepository extends BaseRepository<IImage> {
	constructor(@inject("ImageModel") model: Model<IImage>) {
		super(model);
	}

	/**
	 * Finds an image by its public ID and returns only its internal MongoDB _id.
	 * This is a lightweight, performant way to get an ID for relationship linking.
	 *
	 * @param {string} publicId - The public ID of the image.
	 * @returns {Promise<string | null>} - The internal _id as a string, or null if not found.
	 */
	async findInternalIdByPublicId(publicId: string): Promise<string | null> {
		try {
			if (!publicId || typeof publicId !== "string") {
				return null;
			}

			const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const hasDotOrSlash = publicId.includes(".") || publicId.includes("/");
			const filter = hasDotOrSlash
				? { publicId }
				: { publicId: { $regex: new RegExp(`^${escapeRegex(publicId)}(?:\\.(?:png|jpe?g|webp|gif))?$`, "i") } };
			const doc = await this.model.findOne(filter).select("_id").lean<{ _id: Types.ObjectId }>().exec();

			return doc ? doc._id.toString() : null;
		} catch (error) {
			console.error(`Error in findInternalIdByPublicId for publicId: ${publicId}`, error);
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Finds an image by its ID and populates related fields.
	 *
	 * @param {string} id - The ID of the image.
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<IImage | null>} - The found image or null if not found.
	 */
	async findById(id: string, session?: ClientSession): Promise<IImage | null> {
		try {
			if (!mongoose.Types.ObjectId.isValid(id)) {
				throw createError("ValidationError", "Invalid image ID");
			}
			const query = this.model.findById(id).populate("user", "username avatar publicId");

			if (session) query.session(session);
			const result = await query.exec();
			logger.info(result);
			return result;
		} catch (error) {
			if (isNamedError(error) && error.name === "ValidationError") {
				throw error;
			}
			throw createError("DatabaseError", (error as Error).message);
		}
	}

	/**
	 * Deletes all images associated with a specific user.
	 * Supports MongoDB transactions if a session is provided.
	 *
	 * @param {string} userId - The ID of the user whose images will be deleted.
	 * @param {ClientSession} [session] - Optional MongoDB transaction session.
	 * @returns {Promise<void>} - Resolves when deletion is complete.
	 */
	async deleteMany(userId: string, session?: ClientSession): Promise<void> {
		try {
			const query = this.model.deleteMany({ user: userId });
			if (session) query.session(session);
			const result = await query.exec();
			logger.info(`result from await query.exec() : ${result} `);
		} catch (error) {
			throw createError("DatabaseError", (error as Error).message);
		}
	}
}
