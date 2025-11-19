import { ImageRepository } from "../repositories/image.repository";
import { PostRepository } from "../repositories/post.repository";
import { TagRepository } from "../repositories/tag.repository";
import { UserRepository } from "../repositories/user.repository";
import { IPost, IUser } from "../types";
import { createError } from "../utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class SearchService {
	constructor(
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("TagRepository") private readonly tagRepository: TagRepository
	) {}

	/** Universal search function. It uses a query and search throughout the database

	 */
	async searchAll(query: string[]): Promise<{
		users: IUser[] | null;
		posts: IPost[] | null;
	}> {
		try {
			//Search for users by query
			const users = await this.userRepository.getAll({ search: query });

			// Search for tags to find relevant posts
			const tags = await this.tagRepository.searchTags(query);
			const tagIds = tags.map((tag) => tag._id);

			// Search for posts by tag IDs
			const posts = await this.postRepository.findByTags(tagIds as string[]);

			return {
				users: users || null,
				posts: posts?.data.length ? posts?.data : null,
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
