import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPostsByUserQuery } from "./getPostsByUser.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { DTOService } from "../../../../services/dto.service";
import { PaginationResult, PostDTO } from "../../../../types";

@injectable()
export class GetPostsByUserQueryHandler implements IQueryHandler<GetPostsByUserQuery, PaginationResult<PostDTO>> {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetPostsByUserQuery): Promise<PaginationResult<PostDTO>> {
		const result = await this.postRepository.findByUserPublicId(query.userPublicId, {
			page: query.page,
			limit: query.limit,
		});
		return {
			...result,
			data: result.data.map((entry: any) => this.dtoService.toPostDTO(entry)),
		};
	}
}
