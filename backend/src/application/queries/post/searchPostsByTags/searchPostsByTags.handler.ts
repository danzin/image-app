import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { SearchPostsByTagsQuery } from "./searchPostsByTags.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { TagService } from "../../../../services/tag.service";
import { DTOService } from "../../../../services/dto.service";
import { PaginationResult, PostDTO } from "../../../../types";

@injectable()
export class SearchPostsByTagsQueryHandler implements IQueryHandler<SearchPostsByTagsQuery, PaginationResult<PostDTO>> {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("TagService") private readonly tagService: TagService,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: SearchPostsByTagsQuery): Promise<PaginationResult<PostDTO>> {
		// if no tags provided, return all posts
		if (query.tags.length === 0) {
			const result = await this.postRepository.findWithPagination({ page: query.page, limit: query.limit });
			return {
				...result,
				data: result.data.map((entry: any) => this.dtoService.toPostDTO(entry)),
			};
		}

		const tagIds = await this.tagService.resolveTagIds(query.tags);
		const result = await this.postRepository.findByTags(tagIds, { page: query.page, limit: query.limit });

		return {
			...result,
			data: result.data.map((entry: any) => this.dtoService.toPostDTO(entry)),
		};
	}
}
