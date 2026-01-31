import { inject, injectable } from "tsyringe";
import { IQueryHandler } from "@/application/common/interfaces/query-handler.interface";
import { CheckFollowStatusQuery } from "./checkFollowStatus.query";
import { FollowRepository } from "@/repositories/follow.repository";

@injectable()
export class CheckFollowStatusQueryHandler implements IQueryHandler<CheckFollowStatusQuery, boolean> {
	constructor(@inject("FollowRepository") private readonly followRepository: FollowRepository) {}

	async execute(query: CheckFollowStatusQuery): Promise<boolean> {
		return this.followRepository.isFollowingByPublicId(query.followerPublicId, query.targetPublicId);
	}
}
