import { ImageRepository } from "@/repositories/image.repository";
import { PostRepository } from "@/repositories/post.repository";
import { TagRepository } from "@/repositories/tag.repository";
import { UserRepository } from "@/repositories/user.repository";
import { CommunityRepository } from "@/repositories/community.repository";
import { IPost, IUser, ICommunity } from "@/types";
import { createError } from "@/utils/errors";
import { inject, injectable } from "tsyringe";

@injectable()
export class SearchService {
	constructor(
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("TagRepository") private readonly tagRepository: TagRepository,
		@inject("CommunityRepository") private readonly communityRepository: CommunityRepository,
	) {}

	/** Universal search function. It uses a query and search throughout the database for users, posts, and communities.
	 */
	async searchAll(query: string[]): Promise<{
		users: IUser[] | null;
		posts: IPost[] | null;
		communities: ICommunity[] | null;
	}> {
		try {
			// Execute independent search queries in parallel
			const [users, communities, tags] = await Promise.all([
				this.userRepository.getAll({ search: query }),
				this.communityRepository.search(query),
				this.tagRepository.searchTags(query),
			]);

			// Search for posts by tag IDs (dependent on tags result)
			const tagIds = tags.map((tag) => tag._id);
			const posts = await this.postRepository.findByTags(tagIds as string[]);

			return {
				users: users || null,
				posts: posts?.data.length ? posts?.data : null,
				communities: communities || null,
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
