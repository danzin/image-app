import { inject, injectable } from "tsyringe";
import { Types } from "mongoose";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetCommunityDetailsQuery } from "./getCommunityDetails.query";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { CommunityMemberRepository } from "../../../../repositories/communityMember.repository";
import { IUserReadRepository } from "../../../../repositories/interfaces/IUserReadRepository";
import { ICommunity } from "../../../../types";
import { createError } from "../../../../utils/errors";

interface CommunityDetailsResult extends Omit<ICommunity, never> {
	isMember?: boolean;
	isCreator?: boolean;
}

@injectable()
export class GetCommunityDetailsQueryHandler
	implements IQueryHandler<GetCommunityDetailsQuery, CommunityDetailsResult>
{
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject("UserReadRepository") private userRepository: IUserReadRepository
	) {}

	async execute(query: GetCommunityDetailsQuery): Promise<CommunityDetailsResult> {
		const community = await this.communityRepository.findBySlug(query.slug);
		if (!community) {
			throw createError("NotFound", "Community not found");
		}

		const result: CommunityDetailsResult = community.toJSON() as CommunityDetailsResult;

		// check if viewer is a member
		if (query.viewerPublicId) {
			const user = await this.userRepository.findByPublicId(query.viewerPublicId);
			if (user) {
				const membership = await this.communityMemberRepository.findByCommunityAndUser(
					community._id as Types.ObjectId,
					user._id as Types.ObjectId
				);
				result.isMember = !!membership;
				result.isCreator = community.creatorId.toString() === user.publicId.toString();
			}
		}

		return result;
	}
}
