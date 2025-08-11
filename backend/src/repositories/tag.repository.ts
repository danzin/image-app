import mongoose, { ClientSession, Model } from "mongoose";
import { Tag } from "../models/image.model";
import { ITag } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";
import { BaseRepository } from "./base.repository";

@injectable()
export class TagRepository extends BaseRepository<ITag> {
	constructor(@inject("TagModel") model: Model<ITag>) {
		super(model);
	}

	/**
	 * Retrieves all tags from the database.
	 * @returns {Promise<ITag[] | null>} - A promise that resolves to an array of tags or null.
	 */
	async getAll(): Promise<ITag[] | null> {
		return this.model.find({}).exec();
	}

	/**
	 * Finds a tag by its name.
	 * @param {string} tag - The tag name to search for.
	 * @param {ClientSession} [session] - Optional Mongoose session for transactions.
	 * @returns {Promise<ITag | null>} - A promise that resolves to the found tag or null if not found.
	 * @throws {Error} - Throws a 'DatabaseError' if the update operation fails.
	 */
	async findByTag(tag: string, session?: ClientSession): Promise<ITag | null> {
		try {
			const query = this.model.findOne({ tag }).populate("tag", "tag");

			if (session) query.session(session);
			return await query.exec();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw createError("DatabaseError", message);
		}
	}

	/**
	 * Searches for tags that match any of the given search queries.
	 * Uses case-insensitive regex matching for partial matches.
	 * @param {string[]} searchQueries - An array of search terms.
	 * @param {ClientSession} [session] - Optional Mongoose session for transactions.
	 * @returns {Promise<ITag[]>} - A promise that resolves to an array of matching tags.
	 * @throws {Error} - Throws a 'DatabaseError' if the update operation fails.
	 */
	async searchTags(searchQueries: string[], session?: ClientSession): Promise<ITag[]> {
		try {
			// Builds a search query using $or to match any of the search terms
			const query = this.model.find({
				$or: searchQueries.map((term: string) => {
					return { tag: { $regex: term, $options: "i" } };
				}),
			});

			if (session) query.session(session);
			return await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message);
		}
	}
}
