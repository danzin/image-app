import { PostRepository } from "@/repositories/post.repository";
import { TagRepository } from "@/repositories/tag.repository";
import { UserRepository } from "@/repositories/user.repository";
import { CommunityRepository } from "@/repositories/community.repository";
import { PostDTO } from "@/types";
import { createError } from "@/utils/errors";
import { inject, injectable } from "tsyringe";
import { DTOService, PublicUserDTO, CommunityDTO } from "@/services/dto.service";

@injectable()
export class SearchService {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("TagRepository") private readonly tagRepository: TagRepository,
		@inject("CommunityRepository") private readonly communityRepository: CommunityRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
	) {}

	/** Universal search function. It uses a query and search throughout the database for users, posts, and communities.
	 */
	async searchAll(query: string[]): Promise<{
		users: PublicUserDTO[] | null;
		posts: PostDTO[] | null;
		communities: CommunityDTO[] | null;
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
			const postDTOs = posts?.data?.map((post) => this.dtoService.toPostDTO(post)) ?? [];
			const userDTOs = users?.map((user) => this.dtoService.toPublicDTO(user)) ?? [];
			const communityDTOs = communities?.map((community) => this.dtoService.toCommunityDTO(community)) ?? [];

			return {
				users: userDTOs.length ? userDTOs : null,
				posts: postDTOs.length ? postDTOs : null,
				communities: communityDTOs.length ? communityDTOs : null,
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
