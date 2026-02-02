import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetFollowersQuery } from "./getFollowers.query";
import { inject, injectable } from "tsyringe";
import { FollowRepository } from "@/repositories/follow.repository";
import { IUserReadRepository } from "@/repositories/interfaces";
import { createError } from "@/utils/errors";

export interface FollowUserItem {
	publicId: string;
	handle: string;
	username: string;
	avatar: string;
	bio?: string;
}

export interface GetFollowersResult {
	users: FollowUserItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

@injectable()
export class GetFollowersQueryHandler implements IQueryHandler<GetFollowersQuery, GetFollowersResult> {
	constructor(
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository
	) {}

	async execute(query: GetFollowersQuery): Promise<GetFollowersResult> {
		try {
			const user = await this.userReadRepository.findByPublicId(query.userPublicId);
			if (!user) {
				throw createError("NotFoundError", "User not found");
			}

			const followerIds = await this.followRepository.getFollowerObjectIds(String(user._id));
			const total = followerIds.length;
			const totalPages = Math.ceil(total / query.limit);

			// paginate the IDs
			const startIndex = (query.page - 1) * query.limit;
			const endIndex = startIndex + query.limit;
			const paginatedIds = followerIds.slice(startIndex, endIndex);

			const users: FollowUserItem[] = [];
			for (const id of paginatedIds) {
				const followerUser = await this.userReadRepository.findById(id);
				if (followerUser) {
					users.push({
						publicId: followerUser.publicId,
						handle: followerUser.handle,
						username: followerUser.username,
						avatar: followerUser.avatar || "",
						bio: followerUser.bio,
					});
				}
			}

			return {
				users,
				total,
				page: query.page,
				limit: query.limit,
				totalPages,
			};
		} catch (error) {
			console.error("Error in GetFollowersQueryHandler:", error);
			if (error instanceof Error && error.name !== "Error") {
				throw error;
			}
			throw createError("UnknownError", "Failed to get followers");
		}
	}
}
