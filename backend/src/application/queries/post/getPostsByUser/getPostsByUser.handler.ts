import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPostsByUserQuery } from "./getPostsByUser.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { DTOService } from "../../../../services/dto.service";
import { UserPostsResult } from "../../../../types";
import { UserService } from "../../../../services/user.service";

@injectable()
export class GetPostsByUserQueryHandler implements IQueryHandler<GetPostsByUserQuery, UserPostsResult> {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("UserService") private readonly userService: UserService
	) {}

	async execute(query: GetPostsByUserQuery): Promise<UserPostsResult> {
		const [result, profile] = await Promise.all([
			this.postRepository.findByUserPublicId(query.userPublicId, {
				page: query.page,
				limit: query.limit,
			}),
			this.userService.getPublicProfileByPublicId(query.userPublicId),
		]);
		return {
			...result,
			data: result.data.map((entry: any) => this.dtoService.toPostDTO(entry)),
			profile,
		};
	}
}
