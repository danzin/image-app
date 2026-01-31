import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetUserCommunitiesQuery } from "./getUserCommunities.query";
import { CommunityMemberRepository } from "@/repositories/communityMember.repository";
import { CommunityRepository } from "@/repositories/community.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { ICommunity } from "@/types";
import { createError } from "@/utils/errors";
import { Types } from "mongoose";

interface PaginatedCommunities {
	data: ICommunity[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

@injectable()
export class GetUserCommunitiesQueryHandler implements IQueryHandler<GetUserCommunitiesQuery, PaginatedCommunities> {
	constructor(
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject("UserReadRepository") private userRepository: IUserReadRepository,
	) {}

	async execute(query: GetUserCommunitiesQuery): Promise<PaginatedCommunities> {
		const { userId: userPublicId, page, limit } = query;

		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFound", "User not found");
		}
		const userId = user._id;

		const skip = (page - 1) * limit;

		// get total count for pagination
		const total = await this.communityMemberRepository.countByUser(userId as Types.ObjectId);
		const totalPages = Math.ceil(total / limit);

		const memberships = await this.communityMemberRepository.findByUser(userId as Types.ObjectId, limit, skip);
		const communityIds = memberships.map((m) => m.communityId.toString());

		const communities = await this.communityRepository.findByIds(communityIds);

		// user is querying their own communities so they are members of all of them
		const data = communities.map((c) => {
			const plain = c.toObject ? c.toObject() : c;
			return { ...plain, isMember: true } as ICommunity;
		});

		return { data, total, page, limit, totalPages };
	}
}
