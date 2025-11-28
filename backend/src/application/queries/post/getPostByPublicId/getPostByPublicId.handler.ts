import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetPostByPublicIdQuery } from "./getPostByPublicId.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { FavoriteRepository } from "../../../../repositories/favorite.repository";
import { DTOService } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";
import { PostDTO } from "../../../../types";

@injectable()
export class GetPostByPublicIdQueryHandler implements IQueryHandler<GetPostByPublicIdQuery, PostDTO> {
	constructor(
		@inject("PostRepository") private readonly postRepository: PostRepository,
		@inject("UserRepository") private readonly userRepository: UserRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetPostByPublicIdQuery): Promise<PostDTO> {
		const post = await this.postRepository.findByPublicId(query.publicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}

		const dto = this.dtoService.toPostDTO(post);

		// add viewer-specific fields if viewer is logged in
		if (query.viewerPublicId) {
			const postInternalId = (post as any)._id?.toString();
			const viewerInternalId = await this.userRepository.findInternalIdByPublicId(query.viewerPublicId);

			if (postInternalId && viewerInternalId) {
				const likes = Array.isArray((post as any).likes) ? (post as any).likes : [];
				dto.isLikedByViewer = likes.some((likeEntry: any) => likeEntry?.toString?.() === viewerInternalId);

				const favoriteRecord = await this.favoriteRepository.findByUserAndPost(viewerInternalId, postInternalId);
				dto.isFavoritedByViewer = !!favoriteRecord;
			}
		}

		return dto;
	}
}
