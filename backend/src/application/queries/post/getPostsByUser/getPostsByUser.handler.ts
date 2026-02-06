import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetPostsByUserQuery } from "./getPostsByUser.query";
import { IPostReadRepository } from "@/repositories/interfaces";
import { DTOService, PublicUserDTO } from "@/services/dto.service";
import { UserPostsResult } from "@/types";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { FollowRepository } from "@/repositories/follow.repository";
import { createError } from "@/utils/errors";

@injectable()
export class GetPostsByUserQueryHandler implements IQueryHandler<GetPostsByUserQuery, UserPostsResult> {
	constructor(
		@inject("PostReadRepository") private readonly postReadRepository: IPostReadRepository,
		@inject("DTOService") private readonly dtoService: DTOService,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
		@inject("FollowRepository") private readonly followRepository: FollowRepository
	) {}

	async execute(query: GetPostsByUserQuery): Promise<UserPostsResult> {
		const [result, user] = await Promise.all([
			this.postReadRepository.findByUserPublicId(query.userPublicId, {
				page: query.page,
				limit: query.limit,
				sortBy: query.sortBy,
				sortOrder: query.sortOrder,
			}),
			this.userReadRepository.findByPublicId(query.userPublicId),
		]);

		if (!user) {
			throw createError("NotFoundError", "User not found");
		}

		// attach follow counts
		const userId = user._id!.toString();
		const [followerCount, followingCount] = await Promise.all([
			this.followRepository.countFollowersByUserId(userId),
			this.followRepository.countFollowingByUserId(userId),
		]);

		// set follow counts on the user object
		user.followerCount = followerCount;
		user.followingCount = followingCount;

		const profile: PublicUserDTO = this.dtoService.toPublicDTO(user);

		return {
			...result,
			data: result.data.map((entry) => this.dtoService.toPostDTO(entry)),
			profile,
		};
	}
}
