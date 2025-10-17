import { ClientSession, Model } from "mongoose";
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

	async searchTags(
		searchQueries: string[],
		options?: { limit?: number; minCount?: number },
		session?: ClientSession
	): Promise<ITag[]> {
		try {
			const { limit = 50, minCount = 0 } = options || {};
			const searchText = searchQueries.join(" ");

			const query = this.model
				.find(
					{
						$text: { $search: searchText },
						count: { $gte: minCount }, //filter unpopular tags
					},
					{ score: { $meta: "textScore" } }
				)
				.sort({
					score: { $meta: "textScore" }, // relevance
					count: -1, // popularity
				})
				.limit(limit);

			if (session) query.session(session);
			return await query.exec();
		} catch (error: any) {
			throw createError("DatabaseError", error.message);
		}
	}
}
