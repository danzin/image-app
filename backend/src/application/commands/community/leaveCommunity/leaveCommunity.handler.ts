import { inject, injectable } from "tsyringe";
import { Types } from "mongoose";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { LeaveCommunityCommand } from "./leaveCommunity.command";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { CommunityMemberRepository } from "../../../../repositories/communityMember.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { createError } from "../../../../utils/errors";

@injectable()
export class LeaveCommunityCommandHandler implements ICommandHandler<LeaveCommunityCommand, void> {
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject(UserRepository) private userRepository: UserRepository,
		@inject(UnitOfWork) private uow: UnitOfWork
	) {}

	async execute(command: LeaveCommunityCommand): Promise<void> {
		const { communityId: communityPublicId, userId: userPublicId } = command;

		const user = await this.userRepository.findByPublicId(userPublicId);
		if (!user) {
			throw createError("NotFound", "User not found");
		}
		const userId = user._id as Types.ObjectId;

		const community = await this.communityRepository.findByPublicId(communityPublicId);
		if (!community) {
			throw createError("NotFound", "Community not found");
		}
		const communityId = community._id as Types.ObjectId;

		const member = await this.communityMemberRepository.findByCommunityAndUser(communityId, userId);
		if (!member) {
			throw createError("BadRequest", "User is not a member of this community");
		}

		await this.uow.executeInTransaction(async (session) => {
			// 1. Remove Member
			await this.communityMemberRepository.deleteByCommunityAndUser(communityId, userId, session);

			// 2. Update User Cache (Remove from array)
			await this.userRepository.update(
				userId.toString(),
				{
					$pull: {
						joinedCommunities: { _id: communityId },
					},
				} as any,
				session
			);

			// 3. Decrement Member Count
			await this.communityRepository.update(
				communityId.toString(),
				{
					$inc: { "stats.memberCount": -1 },
				} as any,
				session
			);
		});
	}
}
