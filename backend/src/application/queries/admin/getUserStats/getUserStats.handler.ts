import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetUserStatsQuery } from "./getUserStats.query";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { ImageRepository } from "../../../../repositories/image.repository";
import { FollowRepository } from "../../../../repositories/follow.repository";
import { PostLikeRepository } from "../../../../repositories/postLike.repository";
import { DTOService, AdminUserDTO } from "../../../../services/dto.service";
import { createError } from "../../../../utils/errors";

export interface UserStatsResult {
	user: AdminUserDTO;
	stats: {
		imageCount: number;
		followerCount: number;
		followingCount: number;
		likeCount: number;
		joinDate: Date;
		lastActivity: Date;
	};
}

@injectable()
export class GetUserStatsQueryHandler implements IQueryHandler<GetUserStatsQuery, UserStatsResult> {
	constructor(
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("ImageRepository") private readonly imageRepository: ImageRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("PostLikeRepository") private readonly postLikeRepository: PostLikeRepository,
		@inject("DTOService") private readonly dtoService: DTOService
	) {}

	async execute(query: GetUserStatsQuery): Promise<UserStatsResult> {
		const user = await this.userReadRepository.findByPublicId(query.userPublicId);
		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		const [imageCount, followerCount, followingCount, likeCount] = await Promise.all([
			this.imageRepository.countDocuments({ user: user.id }),
			this.followRepository.countDocuments({ followee: user.id }),
			this.followRepository.countDocuments({ follower: user.id }),
			this.postLikeRepository.countLikesByUser(user.id),
		]);

		return {
			user: this.dtoService.toAdminDTO(user),
			stats: {
				imageCount,
				followerCount,
				followingCount,
				likeCount,
				joinDate: user.createdAt,
				lastActivity: user.updatedAt,
			},
		};
	}
}
