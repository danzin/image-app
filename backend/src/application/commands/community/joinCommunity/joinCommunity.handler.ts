import { inject, injectable } from "tsyringe";
import { Types } from "mongoose";
import { ICommandHandler } from "../../../common/interfaces/command-handler.interface";
import { JoinCommunityCommand } from "./joinCommunity.command";
import { CommunityRepository } from "../../../../repositories/community.repository";
import { CommunityMemberRepository } from "../../../../repositories/communityMember.repository";
import { UserRepository } from "../../../../repositories/user.repository";
import { UnitOfWork } from "../../../../database/UnitOfWork";
import { createError } from "../../../../utils/errors";

@injectable()
export class JoinCommunityCommandHandler implements ICommandHandler<JoinCommunityCommand, void> {
	constructor(
		@inject(CommunityRepository) private communityRepository: CommunityRepository,
		@inject(CommunityMemberRepository) private communityMemberRepository: CommunityMemberRepository,
		@inject(UserRepository) private userRepository: UserRepository,
		@inject(UnitOfWork) private uow: UnitOfWork
	) {}

	async execute(command: JoinCommunityCommand): Promise<void> {
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

		const existingMember = await this.communityMemberRepository.findByCommunityAndUser(communityId, userId);
		if (existingMember) {
			throw createError("BadRequest", "User is already a member of this community");
		}

		await this.uow.executeInTransaction(async (session) => {
			// 1. Add Member
			await this.communityMemberRepository.create(
				{
					communityId: communityId as any,
					userId: userId,
					role: "member",
				},
				session
			);

			// 2. Update User Cache
			await this.userRepository.update(
				userId.toString(),
				{
					$push: {
						joinedCommunities: {
							$each: [
								{
									_id: community._id,
									name: community.name,
									slug: community.slug,
								},
							],
							$position: 0,
							$slice: 10,
						},
					},
				} as any,
				session
			);

			// 3. Increment Member Count
			await this.communityRepository.update(
				communityId.toString(),
				{
					$inc: { "stats.memberCount": 1 },
				} as any,
				session
			);
		});
	}
}
