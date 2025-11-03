import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPostBySlugQuery } from "./getPostBySlug.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { DTOService } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";
import { PostDTO } from "../../../../types";

@injectable()
export class GetPostBySlugQueryHandler implements IQueryHandler<GetPostBySlugQuery, PostDTO> {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetPostBySlugQuery): Promise<PostDTO> {
		const post = await this.postRepository.findBySlug(query.slug);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}
		return this.dtoService.toPostDTO(post);
	}
}
