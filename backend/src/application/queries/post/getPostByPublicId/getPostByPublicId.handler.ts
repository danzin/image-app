import { inject, injectable } from "tsyringe";
import mongoose from "mongoose";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetPostByPublicIdQuery } from "./getPostByPublicId.query";
import { IPostReadRepository, IUserReadRepository } from "@/repositories/interfaces";
import { FavoriteRepository } from "@/repositories/favorite.repository";
import { PostLikeRepository } from "@/repositories/postLike.repository";
import { CommunityMemberRepository } from "@/repositories/communityMember.repository";
import { DTOService } from "@/services/dto.service";
import { createError } from "@/utils/errors";
import { IPost, PostDTO } from "@/types";

@injectable()
export class GetPostByPublicIdQueryHandler implements IQueryHandler<GetPostByPublicIdQuery, PostDTO> {
	constructor(
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("FavoriteRepository") private readonly favoriteRepository: FavoriteRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("CommunityMemberRepository") private readonly communityMemberRepository: CommunityMemberRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetPostByPublicIdQuery): Promise<PostDTO> {
		const post: IPost | null = await this.postReadRepository.findByPublicId(query.publicId);
		if (!post) {
			throw createError("NotFoundError", "Post not found");
		}

		const dto = this.dtoService.toPostDTO(post);

		// Check author community role
		if (post.communityId) {
			const communityInternalId =
				post.communityId instanceof mongoose.Types.ObjectId ? post.communityId : (post.communityId as any)._id; // Handle populated field if necessary

			const authorInternalId = post.author?._id || post.user;

			if (communityInternalId && authorInternalId) {
				const authorMember = await this.communityMemberRepository.findByCommunityAndUser(
					communityInternalId.toString(),
					authorInternalId.toString()
				);

				if (authorMember && (authorMember.role === "admin" || authorMember.role === "moderator")) {
					dto.authorCommunityRole = authorMember.role;
				}
			}
		}

		// add viewer-specific fields if viewer is logged in
		if (query.viewerPublicId) {
			const postInternalId = post._id?.toString();
			const viewerInternalId = await this.userReadRepository.findInternalIdByPublicId(query.viewerPublicId);

			if (postInternalId && viewerInternalId) {
				dto.isLikedByViewer = await this.postLikeRepository.hasUserLiked(postInternalId, viewerInternalId);

				const favoriteRecord = await this.favoriteRepository.findByUserAndPost(viewerInternalId, postInternalId);
				dto.isFavoritedByViewer = !!favoriteRecord;

				// Check if viewer has reposted this post (or the original if viewing a repost)
				const repostOfDoc = post.repostOf as any;
				const repostCheckTargetId = repostOfDoc?._id
					? repostOfDoc._id.toString()
					: postInternalId;
				const repostCount = await this.postReadRepository.countDocuments({
					user: new mongoose.Types.ObjectId(viewerInternalId),
					repostOf: new mongoose.Types.ObjectId(repostCheckTargetId),
					type: "repost",
				});
				dto.isRepostedByViewer = repostCount > 0;

				// Check delete permission
				const isOwner = post.author.publicId === query.viewerPublicId;
				let canDelete = isOwner;

				if (!canDelete && post.communityId) {
					const communityInternalId =
						post.communityId instanceof mongoose.Types.ObjectId ? post.communityId : (post.communityId as any)._id; // Handle populated field

					if (communityInternalId) {
						const member = await this.communityMemberRepository.findByCommunityAndUser(
							communityInternalId.toString(),
							viewerInternalId.toString()
						);
						if (member && (member.role === "admin" || member.role === "moderator")) {
							canDelete = true;
						}
					}
				}
				dto.canDelete = canDelete;
			}
		}

		return dto;
	}
}
