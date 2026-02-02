import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetFollowingQuery } from "./getFollowing.query";
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

export interface GetFollowingResult {
	users: FollowUserItem[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

@injectable()
export class GetFollowingQueryHandler implements IQueryHandler<GetFollowingQuery, GetFollowingResult> {
	constructor(
		@inject("FollowRepository") private readonly followRepository: FollowRepository,
		@inject("UserReadRepository") private readonly userReadRepository: IUserReadRepository,
	) {}

	async execute(query: GetFollowingQuery): Promise<GetFollowingResult> {
		try {
			const user = await this.userReadRepository.findByPublicId(query.userPublicId);
			if (!user) {
				throw createError("NotFoundError", "User not found");
			}

			const followingIds = await this.followRepository.getFollowingObjectIds(String(user._id));
			const total = followingIds.length;
			const totalPages = Math.ceil(total / query.limit);

			// paginate the IDs
			const startIndex = (query.page - 1) * query.limit;
			const endIndex = startIndex + query.limit;
			const paginatedIds = followingIds.slice(startIndex, endIndex);

			// fetch user details for paginated following
			const users: FollowUserItem[] = [];
			for (const id of paginatedIds) {
				const followingUser = await this.userReadRepository.findById(id);
				if (followingUser) {
					users.push({
						publicId: followingUser.publicId,
						handle: followingUser.handle,
						username: followingUser.username,
						avatar: followingUser.avatar || "",
						bio: followingUser.bio,
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
			console.error("Error in GetFollowingQueryHandler:", error);
			if (error instanceof Error && error.name !== "Error") {
				throw error;
			}
			throw createError("UnknownError", "Failed to get following");
		}
	}
}
