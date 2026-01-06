import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetCommunityMembersQuery } from "./getCommunityMembers.query";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { CommunityMemberRepository } from "../../../../repositories/communityMember.repository";
import { createError } from "../../../../utils/errors";
import { ICommunityMember } from "../../../../types";

interface PaginatedMembers {
	data: ICommunityMember[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

@injectable()
export class GetCommunityMembersQueryHandler implements IQueryHandler<GetCommunityMembersQuery, PaginatedMembers> {
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository
	) {}

	async execute(query: GetCommunityMembersQuery): Promise<PaginatedMembers> {
		const { communitySlug, page, limit } = query;

		const community = await this.communityRepository.findBySlug(communitySlug);
		if (!community) {
			throw createError("NotFound", "Community not found");
		}

		const skip = (page - 1) * limit;
		const data = await this.communityMemberRepository.findByCommunityId(community._id, limit, skip);
		const total = await this.communityMemberRepository.countByCommunityId(community._id);
		const totalPages = Math.ceil(total / limit);

		return { data, total, page, limit, totalPages };
	}
}
