import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetAllCommunitiesQuery } from "./getAllCommunities.query";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { ICommunity } from "../../../../types";

@injectable()
export class GetAllCommunitiesQueryHandler
	implements
		IQueryHandler<
			GetAllCommunitiesQuery,
			{ data: ICommunity[]; total: number; page: number; limit: number; totalPages: number }
		>
{
	constructor(@inject(CommunityRepository) private communityRepository: CommunityRepository) {}

	async execute(
		query: GetAllCommunitiesQuery
	): Promise<{ data: ICommunity[]; total: number; page: number; limit: number; totalPages: number }> {
		const { page, limit, search } = query;
		return this.communityRepository.findAll(page, limit, search);
	}
}
