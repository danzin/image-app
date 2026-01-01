import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "../../../common/interfaces/query-handler.interface";
import { GetCommunityFeedQuery } from "./getCommunityFeed.query";
import { PostRepository } from "../../../../repositories/post.repository";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { IPost } from "../../../../types";
import { createError } from "../../../../utils/errors";

interface PaginatedPosts {
	data: IPost[];
	total: number;
	page: number;
	limit: number;
	totalPages: number;
}

@injectable()
export class GetCommunityFeedQueryHandler implements IQueryHandler<GetCommunityFeedQuery, PaginatedPosts> {
	constructor(
		@inject(PostRepository) private postRepository: PostRepository,
		@inject(CommunityRepository) private communityRepository: CommunityRepository
	) {}

	async execute(query: GetCommunityFeedQuery): Promise<PaginatedPosts> {
		const { communityId: communityPublicId, page, limit } = query;

		const community = await this.communityRepository.findByPublicId(communityPublicId);
		if (!community) {
			throw createError("NotFound", "Community not found");
		}

		const communityId = community._id.toString();
		const data = await this.postRepository.findByCommunityId(communityId, page, limit);
		const total = await this.postRepository.countByCommunityId(communityId);
		const totalPages = Math.ceil(total / limit);

		return { data, total, page, limit, totalPages };
	}
}
