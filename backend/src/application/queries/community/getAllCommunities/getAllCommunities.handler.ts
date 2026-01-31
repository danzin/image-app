import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { GetAllCommunitiesQuery } from "./getAllCommunities.query";
import { CommunityRepository } from "@/repositories/community.repository";
import { CommunityMemberRepository } from "@/repositories/communityMember.repository";
import { IUserReadRepository } from "@/repositories/interfaces/IUserReadRepository";
import { ICommunity } from "@/types";

@injectable()
export class GetAllCommunitiesQueryHandler
	implements
		IQueryHandler<
			GetAllCommunitiesQuery,
			{ data: ICommunity[]; total: number; page: number; limit: number; totalPages: number }
		>
{
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject("UserReadRepository") private userReadRepository: IUserReadRepository,
	) {}

	async execute(
		query: GetAllCommunitiesQuery,
	): Promise<{ data: ICommunity[]; total: number; page: number; limit: number; totalPages: number }> {
		const { page, limit, search, viewerPublicId } = query;
		const result = await this.communityRepository.findAll(page, limit, search);

		if (result.data.length === 0) {
			return result;
		}

		// fetch actual member counts for all communities
		const communityIds = result.data.map((community) => community._id);
		const memberCounts = await Promise.all(
			communityIds.map((id) => this.communityMemberRepository.countByCommunityId(id)),
		);
		const memberCountMap = new Map(communityIds.map((id, index) => [id.toString(), memberCounts[index]]));

		let viewerId = "";
		let membershipSet = new Set<string>();

		if (viewerPublicId) {
			const viewer = await this.userReadRepository.findByPublicId(viewerPublicId);
			if (viewer) {
				viewerId = (viewer as any)._id?.toString?.() ?? "";
				if (viewerId) {
					const memberships = await this.communityMemberRepository.findByUserAndCommunityIds(viewerId, communityIds);
					membershipSet = new Set(memberships.map((member) => member.communityId.toString()));
				}
			}
		}

		const data = result.data.map((community) => {
			const plain = community.toObject ? community.toObject() : community;
			const communityId = community._id.toString();
			const actualMemberCount = memberCountMap.get(communityId) ?? plain.stats?.memberCount ?? 0;
			return {
				...plain,
				stats: {
					...plain.stats,
					memberCount: actualMemberCount,
				},
				isMember: membershipSet.has(communityId),
				isCreator: community.creatorId?.toString() === viewerId,
			} as ICommunity;
		});

		return { ...result, data };
	}
}
