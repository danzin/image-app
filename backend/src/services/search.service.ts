import mongoose from "mongoose";
import { ImageRepository } from "../repositories/image.repository";
import { TagRepository } from "../repositories/tag.repository";
import { UserRepository } from "../repositories/user.repository";
import { IImage, ITag, IUser } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class SearchService {
	constructor(
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("TagRepository") private readonly tagRepository: TagRepository
	) {}

	/** Universal search function. It uses a query and search throughout the database
	 * It returns anything it finds with that query. That way users can search for anything.
	 * Still need to implement this functionality to the frontend. Need to build a search result component to serve results into,
	 * as well as a usercard component.
	 */
	async searchAll(query: string[]): Promise<{ users: IUser[] | null; images: IImage[] | null; tags: ITag[] | null }> {
		try {
			//Search for users by query
			const users = await this.userRepository.getAll({ search: query });

			// Search for tags by query
			const tags = await this.tagRepository.searchTags(query);

			//Extract tag IDs from the found tags
			const tagIds = tags.map((tag) => tag._id);

			//Search for images that have these tag IDs
			const images = await this.imageRepository.findByTags(tagIds as string[]);

			return {
				users: users || null,
				images: images?.data.length ? images?.data : null,
				tags: tags.length ? tags : null,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw createError("InternalServerError", message, {
				function: "searchAll",
				query: query,
			});
		}
	}
}
