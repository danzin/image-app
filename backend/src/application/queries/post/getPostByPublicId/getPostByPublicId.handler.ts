import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPostByPublicIdQuery } from "./getPostByPublicId.query";
import { IPostReadRepository, IUserReadRepository } from "../../../../repositories/interfaces";
import { FavoriteRepository } from "../../../../repositories/favorite.repository";
import { PostLikeRepository } from "../../../../repositories/postLike.repository";
import { DTOService } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";
import { PostDTO } from "../../../../types";

@injectable()
export class GetPostByPublicIdQueryHandler implements IQueryHandler<GetPostByPublicIdQuery, PostDTO> {
	constructor(
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetPostByPublicIdQuery): Promise<PostDTO> {
		const post = await this.postReadRepository.findByPublicId(query.publicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}

		const dto = this.dtoService.toPostDTO(post);

		// add viewer-specific fields if viewer is logged in
		if (query.viewerPublicId) {
			const postInternalId = (post as any)._id?.toString();
			const viewerInternalId = await this.userReadRepository.findInternalIdByPublicId(query.viewerPublicId);

			if (postInternalId && viewerInternalId) {
				dto.isLikedByViewer = await this.postLikeRepository.hasUserLiked(postInternalId, viewerInternalId);

				const favoriteRecord = await this.favoriteRepository.findByUserAndPost(viewerInternalId, postInternalId);
				dto.isFavoritedByViewer = !!favoriteRecord;
			}
		}

		return dto;
	}
}
