import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetPostBySlugQuery } from "./getPostBySlug.query";
import { IPostReadRepository } from "@/repositories/interfaces";
import { DTOService } from "@/services/dto.service";
import { createError } from "@/utils/errors";
import { PostDTO } from "@/types";

@injectable()
export class GetPostBySlugQueryHandler implements IQueryHandler<GetPostBySlugQuery, PostDTO> {
	constructor(
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetPostBySlugQuery): Promise<PostDTO> {
		const post = await this.postReadRepository.findBySlug(query.slug);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}
		return this.dtoService.toPostDTO(post);
	}
}
