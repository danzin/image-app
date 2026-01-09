import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetLikedPostsByUserQuery } from "./getLikedPostsByUser.query";
import { inject, injectable } from "tsyringe";
import { PostLikeRepository } from "../../../../repositories/postLike.repository";
import { IPostReadRepository, IUserReadRepository } from "../../../../repositories/interfaces";
import { DTOService } from "../../../../services/dto.service";
import { PaginationResult, PostDTO } from "../../../../types";
import { createError } from "../../../../utils/errors";

@injectable()
export class GetLikedPostsByUserHandler implements IQueryHandler<GetLikedPostsByUserQuery, PaginationResult<PostDTO>> {
	constructor(
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetLikedPostsByUserQuery): Promise<PaginationResult<PostDTO>> {
		const { userPublicId, page, limit, viewerPublicId } = query;

		const user = await this.userReadRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const { postIds, total } = await this.postLikeRepository.findLikedPostIdsByUser(user.id, page, limit);

		if (postIds.length === 0) {
			return {
				data: [],
				total: 0,
				page,
				limit,
				totalPages: 0,
			};
		}

		// fetch posts by IDs
		const posts = await this.postReadRepository.findPostsByIds(
			postIds.map((id) => id.toString()),
			viewerPublicId
		);

		// Map to DTOs
		const postDTOs = posts.map((post) => this.dtoService.toPostDTO(post));

		return {
			data: postDTOs,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	}
}
